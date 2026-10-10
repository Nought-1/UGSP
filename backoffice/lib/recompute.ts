// Keeps service_queue docs in step with configuration. After a department, service, officer or leave change,
// queues dated today or later get fresh activeEmployees and capacity, and their live tokens a fresh
// estimatedServeAt. Counters and queue status are never touched (bookings may be running), and
// bookedServeAt (the ETA promised at booking) never changes.
import type { Types } from "mongoose";
import { dbConnect } from "./db";
import { CitizenToken, Department, Service, ServiceQueue } from "./models";
import {
  LIVE_STATUSES,
  SERVE_ORDER,
  closedReason,
  countActive,
  dayCapacity,
  etasFor,
  officersFor,
  slotWindows,
  todayIn,
  type CapacityReason,
} from "./queue-core";

type Id = Types.ObjectId | string;

export interface RecomputeScope {
  departmentId?: Id; // every service of the department
  serviceIds?: Id[]; // or just these services
  from?: string; // optional YYYY-MM-DD range (e.g. a leave); never earlier than today
  to?: string;
}

// A queue that now holds more tokens than its capacity, in the day or in an arrival window (a window can also
// vanish when hours change). Its tokens are kept; the admin sees a warning.
export interface QueueConflict {
  queueId: string;
  serviceName: string;
  date: string;
  issued: number;
  capacity: number;
  reason: CapacityReason | null;
  windows: { start: string; booked: number; seats: number }[]; // over-full or vanished windows
}

const ETA_TOLERANCE_MS = 60_000; // don't rewrite ETAs that moved less than a minute

export async function recomputeQueues(scope: RecomputeScope, now: Date) {
  await dbConnect();
  const services = await Service.find(
    scope.serviceIds ? { _id: { $in: scope.serviceIds } } : { departmentId: scope.departmentId }
  ).lean();

  const departments = new Map(
    (await Department.find({ _id: { $in: services.map((s) => s.departmentId) } }).lean()).map((d) => [
      d._id.toString(),
      d,
    ])
  );

  let updated = 0;
  const conflicts: QueueConflict[] = [];

  for (const service of services) {
    const dept = departments.get(service.departmentId.toString());
    if (!dept) continue;

    const today = todayIn(dept.timezone, now);
    const from = scope.from && scope.from > today ? scope.from : today;
    const queues = await ServiceQueue.find({
      serviceId: service._id,
      date: scope.to ? { $gte: from, $lte: scope.to } : { $gte: from },
    }).lean();
    if (queues.length === 0) continue;

    const officers = await officersFor(service._id);

    for (const queue of queues) {
      const active = countActive(officers, queue.date);
      const reason: CapacityReason | null =
        closedReason(dept, queue.date) ??
        (!service.isActive ? "SERVICE_INACTIVE" : active === 0 ? "NO_STAFF" : null);
      const capacity = reason ? 0 : dayCapacity(dept, service, active);

      if (queue.activeEmployees !== active || queue.capacity !== capacity) {
        await ServiceQueue.updateOne({ _id: queue._id }, { $set: { activeEmployees: active, capacity } });
        updated++;
      }
      const counts = (queue.slotCounts ?? {}) as unknown as Record<string, number>; // lean: Map as object
      const grid = slotWindows(dept, service, queue.date, reason ? 0 : active, counts, now);
      const windows = [
        ...grid.filter((w) => w.booked > w.seats).map(({ start, booked, seats }) => ({ start, booked, seats })),
        ...Object.entries(counts)
          .filter(([start, booked]) => booked > 0 && !grid.some((w) => w.start === start))
          .map(([start, booked]) => ({ start, booked, seats: 0 })),
      ];
      if (queue.issuedCount > capacity || windows.length > 0) {
        conflicts.push({
          queueId: queue._id.toString(),
          serviceName: service.name,
          date: queue.date,
          issued: queue.issuedCount,
          capacity,
          reason,
          windows,
        });
      }

      // Live ETAs follow the new staffing; bookedServeAt stays as promised
      const live = await CitizenToken.find({ queueId: queue._id, status: { $in: LIVE_STATUSES } })
        .sort(SERVE_ORDER)
        .select("tokenNumber status slotStart comeEarlyAt startedAt estimatedServeAt")
        .lean();
      const etas = etasFor(live, dept, service, queue.date, active, now);
      const writes = live
        .map((token) => ({ token, eta: etas.get(token.tokenNumber) }))
        .filter(({ token, eta }) => eta && Math.abs(eta.getTime() - token.estimatedServeAt.getTime()) >= ETA_TOLERANCE_MS)
        .map(({ token, eta }) => ({
          updateOne: { filter: { _id: token._id }, update: { $set: { estimatedServeAt: eta } }, timestamps: false },
        }));
      if (writes.length > 0) await CitizenToken.bulkWrite(writes);
    }
  }

  return { updated, conflicts };
}
