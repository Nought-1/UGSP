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

// When a token with `peopleAhead` live tokens before it should be served:
// max(now, opening) + floor(peopleAhead / officers) × average minutes.
// floor, not the spec's ceil: officers serve in parallel, so with 2 officers the 2nd person in line is served
// straight away (ceil(1/2) would add a full service time). With 1 officer both agree.
// Zero officers counts as one; callers flag that day as NO_STAFF.
export function estimateServeAt(
  dept: DeptRules,
  service: ServiceRules,
  ymd: string,
  active: number,
  peopleAhead: number,
  now: Date
): Date {
  const openAt = zonedTimeToDate(ymd, dept.workingHours.start, dept.timezone).getTime();
  const waitMinutes = Math.floor(peopleAhead / Math.max(1, active)) * service.avgServiceMinutes;
  return new Date(Math.max(now.getTime(), openAt) + waitMinutes * 60_000);
}

// ETA for each live token of a queue; `liveNumbersAsc` are their token numbers in ascending order,
// so a token's index is its people-ahead count
export function etasFor(
  liveNumbersAsc: number[],
  dept: DeptRules,
  service: ServiceRules,
  ymd: string,
  active: number,
  now: Date
): Map<number, Date> {
  return new Map(liveNumbersAsc.map((n, ahead) => [n, estimateServeAt(dept, service, ymd, active, ahead, now)]));
}

// ---- Database helpers ----

export async function officersFor(serviceId: Id) {
  return Employee.find({ serviceIds: serviceId, role: "OFFICER" }).select("isActive role leaves").lean();
}

export async function activeEmployeeCount(serviceId: Id, ymd: string): Promise<number> {
  await dbConnect();
  return countActive(await officersFor(serviceId), ymd);
}

// Live tokens in the queue with a lower number
export async function peopleAhead(queueId: Id, tokenNumber: number): Promise<number> {
  await dbConnect();
  return CitizenToken.countDocuments({ queueId, status: { $in: LIVE_STATUSES }, tokenNumber: { $lt: tokenNumber } });
}

export interface CapacityInfo {
  date: string;
  reason: CapacityReason | null;
  activeEmployees: number;
  capacity: number; // whole-day capacity: what service_queue.capacity stores
  cap: number; // most tokens issuable in total as of now (bookingCap)
  issued: number; // non-cancelled tokens issued so far (issuedCount)
  live: number; // WAITING + ARRIVED + IN_SERVICE
  remaining: number; // tokens that can still be booked now
  queueStatus: IServiceQueue["status"] | null; // null: nobody has booked this day yet
}

// Capacity for one service on one day; works before any service_queue doc exists
export async function capacityFor(serviceId: Id, ymd: string, now: Date): Promise<CapacityInfo> {
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

  return {
    date: ymd,
    reason,
    activeEmployees,
    capacity,
    cap,
    issued,
    live,
    remaining: queue?.status === "CLOSED" ? 0 : Math.max(0, cap - issued),
    queueStatus: queue?.status ?? null,
  };
}

// Days a citizen can book now: today through the booking window, open, staffed and not full
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

// Takes the next token number for `ymd`, or returns null when the day is full, closed or unstaffed.
// The caller then inserts the citizen_token with `tokenNumber`; if that insert fails it must give the slot back:
//   ServiceQueue.updateOne({ _id: queueId }, { $inc: { issuedCount: -1 } })   (lastTokenNumber never goes back)
export async function reserveSlot(
  serviceId: Id,
  ymd: string,
  now: Date
): Promise<{ queueId: Types.ObjectId; tokenNumber: number; info: CapacityInfo } | null> {
  const info = await capacityFor(serviceId, ymd, now);
  if (info.remaining <= 0) return null;

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

  // One atomic step guards against overbooking and duplicate numbers
  const updated = await ServiceQueue.findOneAndUpdate(
    { _id: queueId, status: { $ne: "CLOSED" }, issuedCount: { $lt: info.cap } },
    { $inc: { issuedCount: 1, lastTokenNumber: 1 } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) return null;

  return { queueId: updated._id, tokenNumber: updated.lastTokenNumber, info };
}
