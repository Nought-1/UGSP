// Log-only notifier (_notes/backoffice-plan.md §6), started by instrumentation.ts. One pass every 60 s:
//   - BOOKED and CANCELLED confirmations
//   - fresh ETAs on today's OPEN and PAUSED queues
//   - ARRIVE_SOON once a waiting citizen's turn is within the service's alert lead time (OPEN queues, working days)
// COME_EARLY is sent by an officer from the console (notify() below, called by PATCH /api/v1/tokens/[id]).
// Nothing is sent anywhere: each alert is a console line plus entries in the token's notifications log.
// Each alert is claimed with a guarded update, so an overlapping pass or a second server never logs it twice.
import type { Types } from "mongoose";
import { dbConnect } from "./db";
import { Citizen, CitizenToken, Department, Service, ServiceQueue } from "./models";
import { LIVE_STATUSES, SERVE_ORDER, addDays, closedReason, etasFor, todayIn } from "./queue-core";

type NotifyEvent = "BOOKED" | "CANCELLED" | "ARRIVE_SOON" | "COME_EARLY";

export interface PendingToken {
  _id: Types.ObjectId;
  citizenId: Types.ObjectId;
  serviceId: Types.ObjectId;
  tokenNumber: number;
}

const INTERVAL_MS = 60_000;
const BATCH = 200; // per event per pass; the rest wait for the next pass
const ETA_TOLERANCE_MS = 60_000; // don't rewrite ETAs that moved less than a minute

// Logs one entry per channel the citizen picked. EMAIL without an address can't go out, so it is logged FAILED.
// `guard` narrows the claim (e.g. still WAITING); ARRIVE_SOON stamps notifiedAt and COME_EARLY comeEarlyAt.
// Returns how many tokens it logged (0: already logged, or the guard no longer matched).
export async function notify(
  tokens: PendingToken[],
  event: NotifyEvent,
  now: Date,
  guard: Record<string, unknown> = {}
) {
  if (tokens.length === 0) return 0;
  const [citizens, services] = await Promise.all([
    Citizen.find({ _id: { $in: tokens.map((t) => t.citizenId) } }).select("phone email notifyChannels").lean(),
    Service.find({ _id: { $in: tokens.map((t) => t.serviceId) } }).select("code").lean(),
  ]);
  const citizenById = new Map(citizens.map((c) => [c._id.toString(), c]));
  const codeById = new Map(services.map((s) => [s._id.toString(), s.code]));

  let logged = 0;
  for (const token of tokens) {
    const citizen = citizenById.get(token.citizenId.toString());
    const channels: string[] = citizen?.notifyChannels?.length ? citizen.notifyChannels : ["SMS"];
    const entries = channels.map((channel) =>
      channel === "EMAIL" && !citizen?.email
        ? { event, channel, status: "FAILED", sentAt: now, error: "NO_EMAIL" }
        : { event, channel, status: "SENT", sentAt: now }
    );

    const { modifiedCount } = await CitizenToken.updateOne(
      { _id: token._id, "notifications.event": { $ne: event }, ...guard },
      {
        $push: { notifications: { $each: entries } },
        ...(event === "ARRIVE_SOON" ? { $set: { notifiedAt: now } } : {}),
        ...(event === "COME_EARLY" ? { $set: { comeEarlyAt: now } } : {}),
      },
      { timestamps: false }
    );
    if (modifiedCount !== 1) continue; // another pass got there first

    logged++;
    const label = `${codeById.get(token.serviceId.toString()) ?? "?"}-${String(token.tokenNumber).padStart(3, "0")}`;
    const to = entries.map((e) => (e.status === "SENT" ? e.channel : `${e.channel} FAILED (${e.error})`)).join(", ");
    console.info(`[notifier] ${event} ${label} -> ${to} (phone ...${citizen?.phone.slice(-4) ?? "????"})`);
  }
  return logged;
}

// One pass; returns how many alerts it logged and ETAs it moved
export async function runNotifier(now: Date) {
  await dbConnect();
  const counts = { BOOKED: 0, CANCELLED: 0, ARRIVE_SOON: 0, etasRefreshed: 0 };

  // From yesterday on: every zone's today is within a day of UTC's
  const since = addDays(todayIn("UTC", now), -1);
  const pick = "citizenId serviceId tokenNumber";
  const booked = await CitizenToken.find({
    date: { $gte: since },
    status: { $in: LIVE_STATUSES },
    "notifications.event": { $ne: "BOOKED" },
  })
    .select(pick)
    .limit(BATCH)
    .lean();
  counts.BOOKED = await notify(booked, "BOOKED", now);

  const cancelled = await CitizenToken.find({
    date: { $gte: since },
    status: "CANCELLED",
    "notifications.event": { $ne: "CANCELLED" },
  })
    .select(pick)
    .limit(BATCH)
    .lean();
  counts.CANCELLED = await notify(cancelled, "CANCELLED", now);

  for (const dept of await Department.find({ isActive: true }).lean()) {
    try {
      const today = todayIn(dept.timezone, now);
      const queues = await ServiceQueue.find({
        departmentId: dept._id,
        date: today,
        status: { $in: ["OPEN", "PAUSED"] },
      }).lean();
      if (queues.length === 0) continue;

      // Not lean: services saved before alertLeadMinutes existed get its default
      const services = new Map(
        (await Service.find({ _id: { $in: queues.map((q) => q.serviceId) } })).map((s) => [s._id.toString(), s])
      );
      const workingDay = closedReason(dept, today) === null;

      for (const queue of queues) {
        const service = services.get(queue.serviceId.toString());
        if (!service) continue;

        const live = await CitizenToken.find({ queueId: queue._id, status: { $in: LIVE_STATUSES } })
          .sort(SERVE_ORDER)
          .select("citizenId serviceId tokenNumber status slotStart comeEarlyAt startedAt estimatedServeAt notifiedAt")
          .lean();
        const etas = etasFor(live, dept, service, today, queue.activeEmployees, now);
        const etaOf = (tokenNumber: number) => (etas.get(tokenNumber) as Date).getTime();

        // ETAs follow the queue; bookedServeAt (the promise) never changes
        const moved = live.filter((t) => Math.abs(etaOf(t.tokenNumber) - t.estimatedServeAt.getTime()) >= ETA_TOLERANCE_MS);
        if (moved.length > 0) {
          await CitizenToken.bulkWrite(
            moved.map((t) => ({
              updateOne: {
                filter: { _id: t._id },
                update: { $set: { estimatedServeAt: new Date(etaOf(t.tokenNumber)) } },
                timestamps: false,
              },
            }))
          );
          counts.etasRefreshed += moved.length;
        }

        if (queue.status !== "OPEN" || !workingDay) continue;
        const leadMs = service.alertLeadMinutes * 60_000;
        const due = live.filter(
          (t) => t.status === "WAITING" && !t.notifiedAt && etaOf(t.tokenNumber) - leadMs <= now.getTime()
        );
        counts.ARRIVE_SOON += await notify(due, "ARRIVE_SOON", now, {
          status: "WAITING",
          notifiedAt: { $exists: false },
        });
      }
    } catch (error) {
      console.error(`[notifier] ${dept.code}: pass failed`, error); // one department's failure doesn't stop the rest
    }
  }
  return counts;
}

declare global {
  var notifierState: { timer?: ReturnType<typeof setInterval>; running: boolean } | undefined;
}

export function startNotifier() {
  const state = (globalThis.notifierState ??= { running: false });
  if (state.timer) clearInterval(state.timer); // a re-register replaces the old timer, so stale code never runs
  state.timer = setInterval(async () => {
    if (state.running) return; // the previous pass is still going
    state.running = true;
    try {
      await runNotifier(new Date());
    } catch (error) {
      console.error("[notifier] pass failed:", error);
    } finally {
      state.running = false;
    }
  }, INTERVAL_MS);
  state.timer.unref(); // never keeps a process alive by itself
  console.info("[notifier] started (log only, every 60 s)");
}
