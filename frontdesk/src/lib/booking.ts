// Citizen booking operations on department, services, service_queue and citizen_token.
// Capacity, working-day and ETA rules come from the shared queue-core.ts (backoffice owns the master copy).
import type { Types } from "mongoose";
import { dbConnect } from "./db";
import { CitizenToken, Department, Service, ServiceQueue } from "./models";
import type { IDepartment } from "./models/Department";
import type { IService } from "./models/Service";
import type { ICitizenToken } from "./models/CitizenToken";
import * as core from "./queue-core";
import { RouteError } from "./api";
import { tokenLabel } from "./format";
import type {
  AvailabilityDTO,
  BoardDTO,
  OfficeDTO,
  ServiceDTO,
  TokenDTO,
  TokenStatusDTO,
} from "./contract-types";

type Dept = Pick<
  IDepartment,
  "name" | "code" | "address" | "city" | "workingHours" | "weekOffDays" | "holidays" | "timezone" | "isActive"
> & { _id: Types.ObjectId };
type Svc = Pick<
  IService,
  "name" | "code" | "description" | "avgServiceMinutes" | "cutoffTime" | "dailyTokenLimit" | "bookingWindowDays" | "isActive"
> & { _id: Types.ObjectId; departmentId: Types.ObjectId };
type Tok = Pick<
  ICitizenToken,
  "tokenNumber" | "status" | "date" | "estimatedServeAt" | "bookedServeAt" | "createdAt" | "counterNumber"
> & { _id: Types.ObjectId; queueId: Types.ObjectId; serviceId: Types.ObjectId };

const LIVE = core.LIVE_STATUSES;
const isLive = (status: string) => (LIVE as readonly string[]).includes(status);

// --- DTO mappers

function toOfficeDTO(d: Dept, now: Date): OfficeDTO {
  return {
    id: d._id.toString(),
    name: d.name,
    code: d.code,
    address: d.address || undefined,
    city: d.city || undefined,
    workingHours: { start: d.workingHours.start, end: d.workingHours.end },
    weekOffDays: d.weekOffDays,
    timezone: d.timezone,
    isOpenToday: core.isWorkingDay(d, core.todayIn(d.timezone, now)),
  };
}

function toServiceDTO(s: Svc, d: Dept): ServiceDTO {
  return {
    id: s._id.toString(),
    departmentId: d._id.toString(),
    departmentName: d.name,
    city: d.city || undefined,
    name: s.name,
    code: s.code,
    description: s.description || undefined,
    avgServiceMinutes: s.avgServiceMinutes,
    cutoffTime: s.cutoffTime,
    bookingWindowDays: s.bookingWindowDays,
  };
}

function toTokenDTO(t: Tok, s: Svc, d: Dept): TokenDTO {
  return {
    id: t._id.toString(),
    label: tokenLabel(s.code, t.tokenNumber),
    tokenNumber: t.tokenNumber,
    status: t.status,
    date: t.date,
    serviceId: s._id.toString(),
    serviceName: s.name,
    serviceCode: s.code,
    departmentId: d._id.toString(),
    departmentName: d.name,
    timezone: d.timezone,
    estimatedServeAt: t.estimatedServeAt.toISOString(),
    bookedServeAt: t.bookedServeAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
  };
}

// --- Lookups

async function activeServiceWithDept(serviceId: string): Promise<{ service: Svc; dept: Dept }> {
  await dbConnect();
  const service = await Service.findOne({ _id: serviceId, isActive: true }).lean<Svc>();
  const dept = service && (await Department.findOne({ _id: service.departmentId, isActive: true }).lean<Dept>());
  if (!service || !dept) throw new RouteError("NOT_FOUND", "This service is not available", 404);
  return { service, dept };
}

// Service and office of a token (they may be inactive by now; the token still shows)
async function serviceAndDept(serviceId: Types.ObjectId): Promise<{ service: Svc; dept: Dept }> {
  const service = await Service.findById(serviceId).lean<Svc>();
  const dept = service && (await Department.findById(service.departmentId).lean<Dept>());
  if (!service || !dept) throw new RouteError("NOT_FOUND", "Token not found", 404);
  return { service, dept };
}

// The days a citizen may book: today through the service's booking window, in the office's time zone
function bookingWindow(service: Svc, dept: Dept, now: Date): string[] {
  const today = core.todayIn(dept.timezone, now);
  return Array.from({ length: service.bookingWindowDays }, (_, i) => core.addDays(today, i));
}

export async function listDepartments(): Promise<OfficeDTO[]> {
  await dbConnect();
  const depts = await Department.find({ isActive: true }).sort({ name: 1 }).lean<Dept[]>();
  const now = new Date();
  return depts.map((d) => toOfficeDTO(d, now));
}

// Every active service in an active office, sorted by office, then service
export async function listServices(): Promise<ServiceDTO[]> {
  await dbConnect();
  const depts = await Department.find({ isActive: true }).lean<Dept[]>();
  const services = await Service.find({ isActive: true, departmentId: { $in: depts.map((d) => d._id) } }).lean<Svc[]>();

  const deptById = new Map(depts.map((d) => [d._id.toString(), d]));
  return services
    .map((s) => toServiceDTO(s, deptById.get(s.departmentId.toString())!))
    .sort((a, b) => a.departmentName.localeCompare(b.departmentName) || a.name.localeCompare(b.name));
}

// --- Availability

export async function getAvailability(serviceId: string): Promise<AvailabilityDTO> {
  const { service, dept } = await activeServiceWithDept(serviceId);
  const now = new Date();
  const window = bookingWindow(service, dept, now);
  const days = await core.bookableDates(service._id, now);

  return {
    serviceId: service._id.toString(),
    timezone: dept.timezone,
    windowStart: window[0],
    windowEnd: window[window.length - 1],
    dates: days.map((day) => ({
      date: day.date,
      slotsLeft: day.remaining,
      // A new token joins behind every live one
      expectedServeAt: core.estimateServeAt(dept, service, day.date, day.activeEmployees, day.live, now).toISOString(),
    })),
  };
}

// --- Book

export async function bookToken(citizenId: string, serviceId: string, date: string): Promise<TokenDTO> {
  const { service, dept } = await activeServiceWithDept(serviceId);
  const now = new Date();

  const existing = await CitizenToken.findOne({ citizenId, serviceId: service._id, date, status: { $in: LIVE } })
    .select("_id")
    .lean();
  if (existing) {
    throw new RouteError("ALREADY_BOOKED", "You already have a token for this service on this day.", 409, {
      tokenId: existing._id.toString(),
    });
  }

  // Membership (not a range check) also rejects impossible dates like 2026-02-30
  if (!bookingWindow(service, dept, now).includes(date)) {
    throw new RouteError("DATE_NOT_BOOKABLE", "This date can't be booked. Please pick another day.");
  }

  const slot = await core.reserveSlot(service._id, date, now);
  if (!slot) {
    const info = await core.capacityFor(service._id, date, now);
    throw info.reason
      ? new RouteError("DATE_NOT_BOOKABLE", "The office isn't taking tokens on this day. Please pick another day.")
      : new RouteError("DATE_FULL", "This day just filled up. Please pick another day.");
  }

  // Give the number back if the insert fails (lastTokenNumber never goes back, so a gap is fine)
  const release = () =>
    ServiceQueue.updateOne({ _id: slot.queueId, issuedCount: { $gt: 0 } }, { $inc: { issuedCount: -1 } });

  const ahead = await core.peopleAhead(slot.queueId, slot.tokenNumber);
  const eta = core.estimateServeAt(dept, service, date, slot.info.activeEmployees, ahead, now);

  try {
    const token = await CitizenToken.create({
      citizenId,
      queueId: slot.queueId,
      serviceId: service._id,
      date,
      tokenNumber: slot.tokenNumber,
      estimatedServeAt: eta,
      bookedServeAt: eta,
    });
    return toTokenDTO(token, service, dept);
  } catch (err) {
    await release();
    // The partial unique index (one live token per citizen per queue) catches a parallel double booking
    const dup = err as { code?: number; keyPattern?: Record<string, unknown> };
    if (dup.code === 11000 && dup.keyPattern?.citizenId) {
      throw new RouteError("ALREADY_BOOKED", "You already have a token for this service on this day.");
    }
    throw err;
  }
}

// --- Cancel (WAITING tokens from today on)

export async function cancelToken(citizenId: string, tokenId: string): Promise<TokenDTO> {
  await dbConnect();
  const token = await CitizenToken.findOne({ _id: tokenId, citizenId }).lean<Tok>();
  if (!token) throw new RouteError("NOT_FOUND", "Token not found", 404);

  const { service, dept } = await serviceAndDept(token.serviceId);
  const notCancellable = new RouteError("NOT_CANCELLABLE", "This token can no longer be cancelled.");
  if (token.status !== "WAITING" || token.date < core.todayIn(dept.timezone, new Date())) throw notCancellable;

  // The status guard lets only one of two parallel cancels through
  const cancelled = await CitizenToken.findOneAndUpdate(
    { _id: token._id, citizenId, status: "WAITING" },
    { $set: { status: "CANCELLED" } },
    { new: true }
  ).lean<Tok>();
  if (!cancelled) throw notCancellable;

  await ServiceQueue.updateOne({ _id: token.queueId, issuedCount: { $gt: 0 } }, { $inc: { issuedCount: -1 } });
  return toTokenDTO(cancelled, service, dept);
}

// --- Live status (read only; the backoffice notifier persists estimatedServeAt)

export async function getTokenStatus(citizenId: string, tokenId: string): Promise<TokenStatusDTO> {
  await dbConnect();
  const token = await CitizenToken.findOne({ _id: tokenId, citizenId }).lean<Tok>();
  if (!token) throw new RouteError("NOT_FOUND", "Token not found", 404);

  const [{ service, dept }, queue] = await Promise.all([
    serviceAndDept(token.serviceId),
    ServiceQueue.findById(token.queueId).lean(),
  ]);
  if (!queue) throw new RouteError("NOT_FOUND", "Token not found", 404);

  const now = new Date();
  const live = isLive(token.status);
  const ahead = live ? await core.peopleAhead(queue._id, token.tokenNumber) : 0;
  const liveEta = live
    ? core.estimateServeAt(dept, service, token.date, queue.activeEmployees, ahead, now)
    : token.estimatedServeAt;

  return {
    token: toTokenDTO(token, service, dept),
    office: toOfficeDTO(dept, now),
    queueStatus: queue.status,
    nowServing: queue.nowServing,
    peopleAhead: ahead,
    position: ahead + 1,
    liveEtaAt: liveEta.toISOString(),
    waitMin: Math.max(0, Math.round((liveEta.getTime() - now.getTime()) / 60_000)),
    counterNumber: token.counterNumber,
  };
}

// --- My tokens

export async function listMyTokens(citizenId: string, scope: "active" | "past"): Promise<TokenDTO[]> {
  await dbConnect();
  const tokens = await CitizenToken.find({ citizenId }).sort({ date: -1, tokenNumber: -1 }).limit(100).lean<Tok[]>();

  const services = await Service.find({ _id: { $in: tokens.map((t) => t.serviceId) } }).lean<Svc[]>();
  const depts = await Department.find({ _id: { $in: services.map((s) => s.departmentId) } }).lean<Dept[]>();
  const svcById = new Map(services.map((s) => [s._id.toString(), s]));
  const deptById = new Map(depts.map((d) => [d._id.toString(), d]));

  const now = new Date();
  const rows = tokens.flatMap((t) => {
    const s = svcById.get(t.serviceId.toString());
    const d = s && deptById.get(s.departmentId.toString());
    if (!s || !d) return [];
    // Upcoming: still live and dated today or later in the office's time zone
    const upcoming = isLive(t.status) && t.date >= core.todayIn(d.timezone, now);
    return upcoming === (scope === "active") ? [toTokenDTO(t, s, d)] : [];
  });

  // Upcoming: soonest first. Past: newest first (query order).
  return scope === "active" ? rows.sort((a, b) => a.date.localeCompare(b.date) || a.tokenNumber - b.tokenNumber) : rows;
}

// --- Public now-serving board

const UP_NEXT = 3;

// Next opening (day + time) when the office is closed now: later today never, so from tomorrow if past closing
function nextOpening(dept: Dept, now: Date): { date: string; time: string } | null {
  const today = core.todayIn(dept.timezone, now);
  const pastClosing = core.minutesOfDayIn(dept.timezone, now) >= core.hmToMinutes(dept.workingHours.end);
  for (let i = pastClosing ? 1 : 0; i < 15; i++) {
    const day = core.addDays(today, i);
    if (core.isWorkingDay(dept, day)) return { date: day, time: dept.workingHours.start };
  }
  return null;
}

export async function getBoard(departmentId: string): Promise<BoardDTO> {
  await dbConnect();
  const dept = await Department.findOne({ _id: departmentId, isActive: true }).lean<Dept>();
  if (!dept) throw new RouteError("NOT_FOUND", "Office not found", 404);

  const now = new Date();
  const date = core.todayIn(dept.timezone, now);
  const isOpenToday = core.isWorkingDay(dept, date);
  const pastClosing = core.minutesOfDayIn(dept.timezone, now) >= core.hmToMinutes(dept.workingHours.end);

  const [services, queues] = await Promise.all([
    Service.find({ departmentId: dept._id, isActive: true }).sort({ name: 1 }).lean<Svc[]>(),
    ServiceQueue.find({ departmentId: dept._id, date }).lean(),
  ]);

  // Waiting count and the next few numbers in line, per queue, in one aggregate
  const waiting = await CitizenToken.aggregate<{ _id: Types.ObjectId; n: number; next: number[] }>([
    { $match: { queueId: { $in: queues.map((q) => q._id) }, status: { $in: ["WAITING", "ARRIVED"] } } },
    { $sort: { tokenNumber: 1 } },
    { $group: { _id: "$queueId", n: { $sum: 1 }, next: { $push: "$tokenNumber" } } },
    { $project: { n: 1, next: { $slice: ["$next", UP_NEXT] } } },
  ]);
  const waitingByQueue = new Map(waiting.map((w) => [w._id.toString(), w]));
  const queueByService = new Map(queues.map((q) => [q.serviceId.toString(), q]));

  // Tokens still bookable today, from the shared capacity rules (0 when closed or past closing)
  // ponytail: one capacityFor per service per refresh; cache per minute if many boards poll at once
  const available = isOpenToday && !pastClosing
    ? await Promise.all(services.map((s) => core.capacityFor(s._id, date, now).then((info) => info.remaining)))
    : services.map(() => 0);

  return {
    departmentId: dept._id.toString(),
    departmentName: dept.name,
    city: dept.city || undefined,
    date,
    timezone: dept.timezone,
    isOpenNow: isOpenToday && !pastClosing,
    opensNext: isOpenToday && !pastClosing ? null : nextOpening(dept, now),
    services: services.map((s, i) => {
      const q = queueByService.get(s._id.toString());
      const w = q && waitingByQueue.get(q._id.toString());
      return {
        serviceId: s._id.toString(),
        name: s.name,
        code: s.code,
        queueStatus: q?.status ?? null,
        nowServing: q?.nowServing ?? 0,
        waiting: w?.n ?? 0,
        upNext: w?.next ?? [],
        completed: q?.completedCount ?? 0,
        availableToday: available[i],
      };
    }),
  };
}
