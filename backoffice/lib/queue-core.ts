// Shared: identical in backoffice lib/ and frontdesk src/lib/. Change both copies.
//
// Capacity, working-day and ETA rules for the virtual queue (app-plan.md §5, _notes/backoffice-plan.md §0).
// Imports only ./db and ./models (identical in both apps): no next/* and no "@/" alias.
// Every function takes `now`, so a request reads the clock once and the rules stay testable
// (scripts/queue-core.check.ts).
import type { Types } from "mongoose";
import { dbConnect } from "./db";
import { CitizenToken, Department, Employee, Service, ServiceQueue } from "./models";
import type { IDepartment } from "./models/Department";
import type { ILeave } from "./models/Employee";
import type { IService } from "./models/Service";
import type { IServiceQueue } from "./models/ServiceQueue";

export const LIVE_STATUSES = ["WAITING", "ARRIVED", "IN_SERVICE"] as const;

// Citizens book a 30-minute arrival window; officers are given checked-in citizens in serving order:
// earliest window first, then booking order. Tokens booked before windows existed have no slotStart and sort first.
export const SLOT_MINUTES = 30;
export const SERVE_ORDER = { slotStart: 1, tokenNumber: 1 } as const;

export type ClosedReason = "DEPT_INACTIVE" | "WEEK_OFF" | "HOLIDAY";
// Why a service can't take tokens on a day (null: it can)
export type CapacityReason = ClosedReason | "SERVICE_INACTIVE" | "NO_STAFF";

export type DeptRules = Pick<IDepartment, "workingHours" | "weekOffDays" | "holidays" | "timezone" | "isActive">;
export type ServiceRules = Pick<IService, "avgServiceMinutes" | "cutoffTime" | "dailyTokenLimit" | "bookingWindowDays">;
export interface OfficerRules {
  isActive: boolean;
  role: string;
  leaves?: ILeave[];
}

type Id = Types.ObjectId | string;

// ---- Dates and times in a department's IANA time zone (Intl only; no server-zone leaks) ----

const pad = (n: number) => String(n).padStart(2, "0");

function wallClock(timeZone: string, at: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

// "YYYY-MM-DD" for `now` in `timeZone`
export function todayIn(timeZone: string, now: Date): string {
  const { year, month, day } = wallClock(timeZone, now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Minutes since local midnight for `now` in `timeZone`
export function minutesOfDayIn(timeZone: string, now: Date): number {
  const { hour, minute } = wallClock(timeZone, now);
  return hour * 60 + minute;
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

// Calendar arithmetic on "YYYY-MM-DD" strings, done in UTC so no zone can shift the day
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// 0 = Sunday ... 6 = Saturday
export function weekdayOf(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Offset (ms) between wall time in `timeZone` and UTC at instant `at`
function zoneOffsetMs(timeZone: string, at: Date): number {
  const w = wallClock(timeZone, at);
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(at.getTime() / 1000) * 1000;
}

// The instant it is `hm` o'clock on `ymd` in `timeZone`. The offset is measured twice so DST changes land right.
export function zonedTimeToDate(ymd: string, hm: string, timeZone: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  const firstGuess = wallAsUtc - zoneOffsetMs(timeZone, new Date(wallAsUtc));
  return new Date(wallAsUtc - zoneOffsetMs(timeZone, new Date(firstGuess)));
}

// ---- Rules (pure) ----

export function closedReason(dept: DeptRules, ymd: string): ClosedReason | null {
  if (!dept.isActive) return "DEPT_INACTIVE";
  if (dept.weekOffDays.includes(weekdayOf(ymd))) return "WEEK_OFF";
  if (dept.holidays.some((holiday) => holiday.date === ymd)) return "HOLIDAY";
  return null;
}

export const isWorkingDay = (dept: DeptRules, ymd: string) => closedReason(dept, ymd) === null;

// Leave days are inclusive; zero-padded YYYY-MM-DD strings compare in date order
export function isOnLeave(leaves: ILeave[] | undefined, ymd: string): boolean {
  return (leaves ?? []).some((leave) => leave.from <= ymd && ymd <= leave.to);
}

// Officers who can serve on `ymd`. Only OFFICERs count: admins may hold every service (they do in the seed)
// and would inflate capacity.
export function countActive(officers: OfficerRules[], ymd: string): number {
  return officers.filter((o) => o.isActive && o.role === "OFFICER" && !isOnLeave(o.leaves, ymd)).length;
}

// Last serving minute of the day: the service cutoff, but never after the department closes
export function cutoffMinutes(dept: DeptRules, service: ServiceRules): number {
  return Math.min(hmToMinutes(service.cutoffTime), hmToMinutes(dept.workingHours.end));
}

// Tokens that fit in a whole day: min(daily limit, floor(officers × open minutes / average minutes))
export function dayCapacity(dept: DeptRules, service: ServiceRules, active: number): number {
  const minutes = Math.max(0, cutoffMinutes(dept, service) - hmToMinutes(dept.workingHours.start));
  return Math.min(service.dailyTokenLimit, Math.floor((active * minutes) / service.avgServiceMinutes));
}

// Most tokens that may be issued for `ymd` in total, as of `now` (compare with issuedCount).
// Future days: the whole day. Past days: 0. Today: tokens already finished (completed + no-show) plus what still
// fits before the cutoff. The stored capacity is always the whole day, which is what the spec's formula
// got wrong late in the day.
export function bookingCap(
  dept: DeptRules,
  service: ServiceRules,
  ymd: string,
  active: number,
  finished: number,
  now: Date
): number {
  const today = todayIn(dept.timezone, now);
  if (ymd < today) return 0;
  const capacity = dayCapacity(dept, service, active);
  if (ymd > today) return capacity;
  const from = Math.max(minutesOfDayIn(dept.timezone, now), hmToMinutes(dept.workingHours.start));
  const minutesLeft = Math.max(0, cutoffMinutes(dept, service) - from);
  return Math.min(capacity, finished + Math.floor((active * minutesLeft) / service.avgServiceMinutes));
}

// ---- Arrival windows ----

const toHm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export interface SlotWindow {
  start: string; // "HH:mm"
  end: string;
  seats: number; // citizens the window can take
  booked: number; // booked so far (cancellations give theirs back)
  remaining: number; // bookable now: 0 on past days and once the window has started today
}

// Windows aligned to :00 and :30, clipped to [opening, last serving minute)
export function slotGrid(dept: DeptRules, service: ServiceRules): { start: number; end: number }[] {
  const close = cutoffMinutes(dept, service);
  const grid: { start: number; end: number }[] = [];
  for (let start = hmToMinutes(dept.workingHours.start); start < close; ) {
    const end = Math.min(close, (Math.floor(start / SLOT_MINUTES) + 1) * SLOT_MINUTES);
    grid.push({ start, end });
    start = end;
  }
  return grid;
}

// Seats per window: service starts spread evenly over the day (ceil), so the seats add up to the day's capacity
// and a long service still gets a seat in the first window. `counts` is service_queue.slotCounts.
export function slotWindows(
  dept: DeptRules,
  service: ServiceRules,
  ymd: string,
  active: number,
  counts: Record<string, number>,
  now: Date
): SlotWindow[] {
  const today = todayIn(dept.timezone, now);
  const nowMinutes = minutesOfDayIn(dept.timezone, now);
  const open = hmToMinutes(dept.workingHours.start);
  const total = Math.floor((active * Math.max(0, cutoffMinutes(dept, service) - open)) / service.avgServiceMinutes);
  const startsBy = (t: number) => Math.min(total, Math.ceil((active * (t - open)) / service.avgServiceMinutes));

  return slotGrid(dept, service).map(({ start, end }) => {
    const seats = startsBy(end) - startsBy(start);
    const booked = counts[toHm(start)] ?? 0;
    const bookable = ymd > today || (ymd === today && nowMinutes < start);
    return { start: toHm(start), end: toHm(end), seats, booked, remaining: bookable ? Math.max(0, seats - booked) : 0 };
  });
}

// "HH:mm" at which the window starting `slotStart` ends: the next :00 or :30, or the cutoff if that is earlier
export function windowEnd(slotStart: string, dept: DeptRules, service: ServiceRules): string {
  const next = (Math.floor(hmToMinutes(slotStart) / SLOT_MINUTES) + 1) * SLOT_MINUTES;
  return toHm(Math.min(next, cutoffMinutes(dept, service)));
}

// ---- Estimated times ----

export interface LiveToken {
  tokenNumber: number;
  status: string; // WAITING | ARRIVED | IN_SERVICE
  slotStart?: string | null;
  comeEarlyAt?: Date | null;
  startedAt?: Date | null;
}

// Serving order in JS, matching SERVE_ORDER (a missing window sorts first, like MongoDB)
export const byServeOrder = (a: LiveToken, b: LiveToken) =>
  (a.slotStart ?? "").localeCompare(b.slotStart ?? "") || a.tokenNumber - b.tokenNumber;

// When each live token should reach a counter, by replaying auto-call. Officers are lanes that free up every `avg`
// minutes from max(now, opening); tokens in service hold a lane until startedAt + avg. Whenever a lane is free,
// it takes the first token in serving order that has been released by then: at its window start (waiting), now
// (checked in, or asked to come now) or opening (no window). Zero officers counts as one lane (NO_STAFF is flagged
// elsewhere). `live` must be in serving order (byServeOrder / SERVE_ORDER).
// ponytail: O(n^2) replay; fine for one day's queue (a few hundred tokens at most)
export function etasFor(
  live: LiveToken[],
  dept: DeptRules,
  service: ServiceRules,
  ymd: string,
  active: number,
  now: Date
): Map<number, Date> {
  const avg = service.avgServiceMinutes * 60_000;
  const openAt = zonedTimeToDate(ymd, dept.workingHours.start, dept.timezone).getTime();
  const lanes = Array.from({ length: Math.max(1, active) }, () => Math.max(now.getTime(), openAt));
  const earliestLane = () => lanes.indexOf(Math.min(...lanes));
  const etas = new Map<number, Date>();

  for (const token of live.filter((t) => t.status === "IN_SERVICE")) {
    const started = token.startedAt?.getTime() ?? now.getTime();
    const lane = earliestLane();
    lanes[lane] = Math.max(lanes[lane], started + avg);
    etas.set(token.tokenNumber, new Date(started));
  }

  const pending = live
    .filter((t) => t.status !== "IN_SERVICE")
    .map((token) => ({
      token,
      release:
        token.status === "ARRIVED" || token.comeEarlyAt
          ? now.getTime()
          : token.slotStart
            ? zonedTimeToDate(ymd, token.slotStart, dept.timezone).getTime()
            : openAt,
    }));
  while (pending.length > 0) {
    const lane = earliestLane();
    let next = pending.findIndex((p) => p.release <= lanes[lane]);
    if (next === -1) {
      // nobody released yet: the lane waits for the first release (earliest in serving order on a tie)
      next = pending.reduce((best, p, i) => (p.release < pending[best].release ? i : best), 0);
    }
    const [{ token, release }] = pending.splice(next, 1);
    const at = Math.max(lanes[lane], release);
    lanes[lane] = at + avg;
    etas.set(token.tokenNumber, new Date(at));
  }
  return etas;
}

// ---- Database helpers ----

export async function officersFor(serviceId: Id) {
  return Employee.find({ serviceIds: serviceId, role: "OFFICER" }).select("isActive role leaves").lean();
}

export async function activeEmployeeCount(serviceId: Id, ymd: string): Promise<number> {
  await dbConnect();
  return countActive(await officersFor(serviceId), ymd);
}

// Live tokens of a queue in serving order, with what the ETA needs
export async function liveInOrder(queueId: Id): Promise<LiveToken[]> {
  await dbConnect();
  return CitizenToken.find({ queueId, status: { $in: LIVE_STATUSES } })
    .sort(SERVE_ORDER)
    .select("tokenNumber status slotStart comeEarlyAt startedAt")
    .lean();
}

export interface CapacityInfo {
  date: string;
  reason: CapacityReason | null;
  activeEmployees: number;
  capacity: number; // whole-day capacity: what service_queue.capacity stores
  cap: number; // most tokens issuable in total as of now (bookingCap)
  issued: number; // non-cancelled tokens issued so far (issuedCount)
  live: number; // WAITING + ARRIVED + IN_SERVICE
  remaining: number; // tokens that can still be booked now (day limit and windows)
  queueStatus: IServiceQueue["status"] | null; // null: nobody has booked this day yet
  windows: SlotWindow[];
}

async function dayState(serviceId: Id, ymd: string, now: Date) {
  await dbConnect();
  const service = await Service.findById(serviceId).lean();
  if (!service) throw new Error(`Service ${serviceId} not found`);
  const [dept, officers, queue] = await Promise.all([
    Department.findById(service.departmentId).lean(),
    officersFor(service._id),
    ServiceQueue.findOne({ serviceId: service._id, date: ymd }).lean(),
  ]);
  if (!dept) throw new Error(`Department ${service.departmentId} not found`);

  const live = queue ? await CitizenToken.countDocuments({ queueId: queue._id, status: { $in: LIVE_STATUSES } }) : 0;
  const issued = queue?.issuedCount ?? 0;
  const activeEmployees = countActive(officers, ymd);
  const reason: CapacityReason | null =
    closedReason(dept, ymd) ?? (!service.isActive ? "SERVICE_INACTIVE" : activeEmployees === 0 ? "NO_STAFF" : null);
  const capacity = reason ? 0 : dayCapacity(dept, service, activeEmployees);
  const cap = reason ? 0 : bookingCap(dept, service, ymd, activeEmployees, issued - live, now);
  const counts = (queue?.slotCounts ?? {}) as unknown as Record<string, number>; // lean reads the Map as an object
  const windows = slotWindows(dept, service, ymd, reason ? 0 : activeEmployees, counts, now);
  const windowsLeft = windows.reduce((sum, w) => sum + w.remaining, 0);

  const info: CapacityInfo = {
    date: ymd,
    reason,
    activeEmployees,
    capacity,
    cap,
    issued,
    live,
    remaining: queue?.status === "CLOSED" ? 0 : Math.max(0, Math.min(cap - issued, windowsLeft)),
    queueStatus: queue?.status ?? null,
    windows,
  };
  return { service, dept, queue, info };
}

// Capacity for one service on one day; works before any service_queue doc exists
export async function capacityFor(serviceId: Id, ymd: string, now: Date): Promise<CapacityInfo> {
  return (await dayState(serviceId, ymd, now)).info;
}

// The day's windows for the booking screen, each with the time a booking made now would be served
export async function windowsFor(
  serviceId: Id,
  ymd: string,
  now: Date
): Promise<{ info: CapacityInfo; windows: (SlotWindow & { expectedServeAt: Date })[] }> {
  const { service, dept, queue, info } = await dayState(serviceId, ymd, now);
  const live = queue ? await liveInOrder(queue._id) : [];
  const ghost = Number.MAX_SAFE_INTEGER; // the imaginary new booking, last in its window
  return {
    info,
    windows: info.windows.map((w) => {
      const list = [...live, { tokenNumber: ghost, status: "WAITING", slotStart: w.start }].sort(byServeOrder);
      const eta = etasFor(list, dept, service, ymd, info.activeEmployees, now).get(ghost) as Date;
      return { ...w, expectedServeAt: eta };
    }),
  };
}

// ETA and people ahead for one token; `me` may not be stored yet (booking asks before inserting)
export async function tokenEta(queueId: Id, me: LiveToken, now: Date): Promise<{ eta: Date; peopleAhead: number }> {
  await dbConnect();
  const queue = await ServiceQueue.findById(queueId).lean();
  if (!queue) throw new Error(`Queue ${queueId} not found`);
  const [service, dept, live] = await Promise.all([
    Service.findById(queue.serviceId).lean(),
    Department.findById(queue.departmentId).lean(),
    liveInOrder(queueId),
  ]);
  if (!service || !dept) throw new Error(`Queue ${queueId} has no service or department`);

  const list = live.some((t) => t.tokenNumber === me.tokenNumber) ? live : [...live, me].sort(byServeOrder);
  const etas = etasFor(list, dept, service, queue.date, queue.activeEmployees, now);
  const waiting = list.filter((t) => t.status !== "IN_SERVICE");
  const peopleAhead =
    me.status === "IN_SERVICE"
      ? 0
      : list.length - waiting.length + waiting.findIndex((t) => t.tokenNumber === me.tokenNumber);
  return { eta: etas.get(me.tokenNumber) as Date, peopleAhead };
}

// Days a citizen can book now: today through the booking window, open, staffed and with a window left
export async function bookableDates(serviceId: Id, now: Date): Promise<CapacityInfo[]> {
  await dbConnect();
  const service = await Service.findById(serviceId).select("departmentId bookingWindowDays").lean();
  if (!service) return [];
  const dept = await Department.findById(service.departmentId).select("timezone").lean();
  if (!dept) return [];

  const today = todayIn(dept.timezone, now);
  const days = Array.from({ length: service.bookingWindowDays }, (_, i) => addDays(today, i));
  const infos = await Promise.all(days.map((day) => capacityFor(serviceId, day, now)));
  return infos.filter((info) => info.remaining > 0);
}

// Takes the next token number in the arrival window starting `slotStart` ("HH:mm") on `ymd`, or returns null when
// the window or the day is full, closed, unstaffed or already started. The caller then inserts the citizen_token
// with `tokenNumber` and `slotStart`; if that insert fails it gives the seat back with releaseSlot().
export async function reserveSlot(
  serviceId: Id,
  ymd: string,
  slotStart: string,
  now: Date
): Promise<{ queueId: Types.ObjectId; tokenNumber: number; slotStart: string; info: CapacityInfo } | null> {
  const info = await capacityFor(serviceId, ymd, now);
  // Only a window from the computed grid becomes a field path (slotStart comes from the citizen)
  const window = info.windows.find((w) => w.start === slotStart);
  if (info.remaining <= 0 || !window || window.remaining <= 0) return null;

  const service = await Service.findById(serviceId).select("departmentId").lean();
  if (!service) return null;
  const key = { serviceId: service._id, date: ymd };

  // First booking of the day creates the queue doc; two first bookings racing hit E11000 and the loser reads it
  const findQueueId = async () => (await ServiceQueue.findOne(key).select("_id").lean())?._id ?? null;
  let queueId = await findQueueId();
  if (!queueId) {
    try {
      const created = await ServiceQueue.findOneAndUpdate(
        key,
        {
          $setOnInsert: {
            departmentId: service.departmentId,
            activeEmployees: info.activeEmployees,
            capacity: info.capacity,
          },
        },
        { upsert: true, returnDocument: "after", projection: { _id: 1 } }
      ).lean();
      queueId = created?._id ?? null;
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      queueId = await findQueueId();
    }
  }
  if (!queueId) return null;

  // One atomic step guards the day, the window and duplicate numbers ($not $gte also matches a missing counter)
  const path = `slotCounts.${window.start}`;
  const updated = await ServiceQueue.findOneAndUpdate(
    { _id: queueId, status: { $ne: "CLOSED" }, issuedCount: { $lt: info.cap }, [path]: { $not: { $gte: window.seats } } },
    { $inc: { issuedCount: 1, lastTokenNumber: 1, [path]: 1 } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) return null;

  return { queueId: updated._id, tokenNumber: updated.lastTokenNumber, slotStart: window.start, info };
}

// Gives a seat back: a cancelled token, or a booking whose insert failed. lastTokenNumber never goes back.
export async function releaseSlot(queueId: Id, slotStart?: string | null): Promise<void> {
  await dbConnect();
  const path = slotStart && /^\d{2}:\d{2}$/.test(slotStart) ? `slotCounts.${slotStart}` : null;
  await ServiceQueue.updateOne(
    { _id: queueId, issuedCount: { $gt: 0 }, ...(path ? { [path]: { $gt: 0 } } : {}) },
    { $inc: { issuedCount: -1, ...(path ? { [path]: -1 } : {}) } }
  );
}
