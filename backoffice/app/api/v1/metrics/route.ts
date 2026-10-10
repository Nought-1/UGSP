import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { impactOf } from "@/lib/impact";
import { CitizenToken, Department, Service, ServiceQueue } from "@/lib/models";
import { capacityFor, todayIn, zonedTimeToDate } from "@/lib/queue-core";

// GET /api/v1/metrics - today's queue numbers per service, plus the impact of today's served tokens
// (officers see only their services)
export async function GET() {
  try {
    // Re-reads the employee, so deactivation and service reassignment apply without a re-login
    const auth = await requireStaff();
    if (auth.error) return auth.error;

    const serviceFilter: Record<string, unknown> = { isActive: true };
    if (auth.employee.role === "OFFICER") {
      serviceFilter._id = { $in: auth.employee.serviceIds };
    }

    const services = await Service.find(serviceFilter).sort({ name: 1 }).lean();
    const departments = await Department.find({ _id: { $in: services.map((s) => s.departmentId) } })
      .select("name timezone workingHours")
      .lean();
    const deptById = new Map(departments.map((d) => [d._id.toString(), d]));

    // "Today" depends on each department's time zone
    const now = new Date();
    const dates = services.map((s) =>
      todayIn(deptById.get(s.departmentId.toString())?.timezone ?? "Asia/Kolkata", now)
    );
    const queues = services.length
      ? await ServiceQueue.find({
          $or: services.map((s, i) => ({ serviceId: s._id, date: dates[i] })),
        }).lean()
      : [];
    const queueIds = queues.map((q) => q._id);
    const [counts, served, today] = await Promise.all([
      queues.length
        ? CitizenToken.aggregate<{ _id: { queueId: unknown; status: string }; n: number }>([
            { $match: { queueId: { $in: queueIds } } },
            { $group: { _id: { queueId: "$queueId", status: "$status" }, n: { $sum: 1 } } },
          ])
        : [],
      // Tokens called to a counter today, for the impact numbers
      queues.length
        ? CitizenToken.find({ queueId: { $in: queueIds }, startedAt: { $exists: true } })
            .select("serviceId date createdAt arrivedAt startedAt bookedServeAt")
            .lean()
        : [],
      // Why a service can't serve today (week off, holiday, no staff...), for the warning stamps.
      // ponytail: a few small queries per service on each poll; batch it if services grow past a few dozen
      Promise.all(services.map((s, i) => capacityFor(s._id, dates[i], now))),
    ]);

    const count = (queueId: string | undefined, status: string) =>
      counts.find((c) => String(c._id.queueId) === queueId && c._id.status === status)?.n ?? 0;

    const rows = services.map((s, i) => {
      const queue = queues.find((q) => q.serviceId.toString() === s._id.toString());
      const queueId = queue?._id.toString();
      return {
        serviceId: s._id.toString(),
        serviceName: s.name,
        serviceCode: s.code,
        departmentName: deptById.get(s.departmentId.toString())?.name ?? "",
        date: dates[i],
        reason: today[i].reason, // null: open for service today
        queueStatus: queue?.status ?? null, // null: nobody has booked this service for today yet
        issued: queue?.issuedCount ?? 0,
        capacity: queue?.capacity ?? null,
        nowServing: queue?.nowServing ?? 0,
        waiting: count(queueId, "WAITING"),
        arrived: count(queueId, "ARRIVED"),
        inService: count(queueId, "IN_SERVICE"),
        completed: count(queueId, "COMPLETED"),
        noShow: count(queueId, "NO_SHOW"),
      };
    });

    const deptByService = new Map(services.map((s) => [s._id.toString(), deptById.get(s.departmentId.toString())]));
    const impact = impactOf(
      served.flatMap((t) => {
        const dept = deptByService.get(t.serviceId.toString());
        if (!dept || !t.startedAt) return [];
        return [
          {
            openAt: zonedTimeToDate(t.date, dept.workingHours.start, dept.timezone),
            createdAt: t.createdAt,
            arrivedAt: t.arrivedAt,
            startedAt: t.startedAt,
            bookedServeAt: t.bookedServeAt,
          },
        ];
      })
    );

    const sum = (pick: (row: (typeof rows)[number]) => number) => rows.reduce((total, row) => total + pick(row), 0);

    return NextResponse.json({
      success: true,
      services: rows,
      totals: {
        issued: sum((r) => r.issued),
        capacity: sum((r) => r.capacity ?? 0),
        waiting: sum((r) => r.waiting),
        arrived: sum((r) => r.arrived),
        inService: sum((r) => r.inService),
        completed: sum((r) => r.completed),
        noShow: sum((r) => r.noShow),
      },
      impact,
    });
  } catch (error) {
    unstable_rethrow(error); // let Next see dynamic-route signals instead of caching a 500
    console.error("GET /api/v1/metrics error:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}
