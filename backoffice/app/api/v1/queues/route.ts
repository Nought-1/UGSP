import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { dispatchNext } from "@/lib/dispatch";
import { Citizen, CitizenToken, Department, Service, ServiceQueue } from "@/lib/models";
import { SERVE_ORDER, todayIn, windowEnd } from "@/lib/queue-core";

const digitsOf = (value: string) => value.replace(/\D/g, "");

// GET /api/v1/queues - today's queue for each of the officer's services, with every token of the day in serving
// order (earliest window, then number) (OFFICER). It is also where auto-call happens: a free officer who isn't
// away is given the next checked-in citizen (lib/dispatch.ts), so the console's refresh after Complete or a
// check-in brings the next citizen straight away.
//   ?q= a token number, or the last digits of a phone number (4 or more); matching token ids come back in `matches`
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaff("OFFICER");
    if (auth.error) return auth.error;
    const me = auth.employee;
    const q = digitsOf(req.nextUrl.searchParams.get("q") ?? "");

    const assigned = await Service.find({ _id: { $in: me.serviceIds } }).sort({ name: 1 }).lean();
    const departments = await Department.find({ _id: { $in: assigned.map((s) => s.departmentId) } })
      .select("name timezone workingHours")
      .lean();
    const deptById = new Map(departments.map((d) => [d._id.toString(), d]));

    // "Today" depends on each department's time zone
    const now = new Date();
    const todayOf = (s: (typeof assigned)[number]) => todayIn(deptById.get(s.departmentId.toString())?.timezone ?? "UTC", now);
    const queues = assigned.length
      ? await ServiceQueue.find({ $or: assigned.map((s) => ({ serviceId: s._id, date: todayOf(s) })) }).lean()
      : [];
    // A deactivated service stays on the console while it still has a queue today, so booked tokens can be served
    const services = assigned.filter((s) => s.isActive || queues.some((qu) => qu.serviceId.equals(s._id)));
    const loadTokens = () =>
      queues.length
        ? CitizenToken.find({ queueId: { $in: queues.map((queue) => queue._id) } })
            .select("-notifications")
            .sort(SERVE_ORDER)
            .lean()
        : Promise.resolve([]);
    let tokens = await loadTokens();

    // Auto-call: free (nothing in service), not away, and someone is checked in on an OPEN queue
    const openQueueIds = queues.filter((queue) => queue.status === "OPEN").map((queue) => queue._id);
    const serving = tokens.some((t) => t.status === "IN_SERVICE" && t.servedById?.equals(me._id));
    const waitingHere = tokens.some((t) => t.status === "ARRIVED" && openQueueIds.some((id) => id.equals(t.queueId)));
    if (!me.away && !serving && waitingHere && (await dispatchNext(me, openQueueIds, now))) {
      tokens = await loadTokens();
    }
    const citizens = await Citizen.find({ _id: { $in: tokens.map((t) => t.citizenId) } })
      .select("name phone")
      .lean();
    const citizenById = new Map(citizens.map((c) => [c._id.toString(), c]));

    const matches: string[] = [];
    const rows = services.map((service) => {
      const dept = deptById.get(service.departmentId.toString());
      const queue = queues.find((qu) => qu.serviceId.equals(service._id));
      const list = queue ? tokens.filter((t) => t.queueId.equals(queue._id)) : [];

      const view = list.map((t) => {
        const phone = citizenById.get(t.citizenId.toString())?.phone ?? "";
        // Matched here rather than in a query, so no user input reaches a regex
        if (q && (t.tokenNumber === Number(q) || (q.length >= 4 && digitsOf(phone).endsWith(q)))) {
          matches.push(t._id.toString());
        }
        return {
          _id: t._id.toString(),
          tokenNumber: t.tokenNumber,
          status: t.status,
          citizenName: citizenById.get(t.citizenId.toString())?.name ?? "Unknown",
          phoneLast4: phone.slice(-4), // staff see only the last 4 digits
          slotStart: t.slotStart ?? null, // arrival window, "HH:mm" (null: booked before windows)
          slotEnd: t.slotStart && dept ? windowEnd(t.slotStart, dept, service) : null,
          comeEarlyAt: t.comeEarlyAt ?? null,
          estimatedServeAt: t.estimatedServeAt,
          arrivedAt: t.arrivedAt ?? null,
          startedAt: t.startedAt ?? null,
          completedAt: t.completedAt ?? null,
          servedById: t.servedById?.toString() ?? null,
          counterNumber: t.counterNumber ?? null,
        };
      });

      return {
        service: { _id: service._id.toString(), name: service.name, code: service.code, isActive: service.isActive },
        department: dept ? { _id: dept._id.toString(), name: dept.name, timezone: dept.timezone } : null,
        date: todayOf(service),
        // null: nobody has booked this service for today yet
        queue: queue
          ? {
              _id: queue._id.toString(),
              status: queue.status,
              issuedCount: queue.issuedCount,
              capacity: queue.capacity,
              nowServing: queue.nowServing, // last called
              completedCount: queue.completedCount,
            }
          : null,
        tokens: view,
        myToken: view.find((t) => t.status === "IN_SERVICE" && t.servedById === me._id.toString()) ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      me: { _id: me._id.toString(), name: me.name, counterNumber: me.counterNumber ?? null, away: me.away ?? false },
      services: rows,
      matches,
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("GET /api/v1/queues error:", error);
    return NextResponse.json({ error: "Failed to fetch queues" }, { status: 500 });
  }
}
