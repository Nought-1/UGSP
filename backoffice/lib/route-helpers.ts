// Helpers shared by the /api/v1 route handlers: errors, body parsing, the admin tables' rows,
// cross-document checks, and the officer's "today's queue" guard.
import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import type { z } from "zod";
import { Department, Employee, Service, ServiceQueue } from "./models";
import type { IEmployee } from "./models/Employee";
import { capacityFor, todayIn } from "./queue-core";

type Id = Types.ObjectId | string;

export const fail = (status: 400 | 403 | 404 | 409, error: string) => NextResponse.json({ error }, { status });

// The body, checked by the same zod schema as the form; the first issue becomes the message
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<{ data: z.output<T>; error: null } | { data: null; error: NextResponse }> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return { data: null, error: fail(400, parsed.error.issues[0]?.message ?? "Invalid request") };
  return { data: parsed.data, error: null };
}

// ---- Admin tables ----

// Services with their department, officers and today's capacity
export async function serviceRows(filter: Record<string, unknown>, now: Date) {
  // Not lean: services saved before alertLeadMinutes existed get its default
  const services = (await Service.find(filter).sort({ name: 1 })).map((s) => s.toObject());
  const [departments, officers] = await Promise.all([
    Department.find({ _id: { $in: services.map((s) => s.departmentId) } })
      .select("name code timezone workingHours")
      .lean(),
    Employee.find({ role: "OFFICER", serviceIds: { $in: services.map((s) => s._id) } })
      .select("name counterNumber isActive serviceIds")
      .sort({ name: 1 })
      .lean(),
  ]);
  const deptById = new Map(departments.map((d) => [d._id.toString(), d]));

  // ponytail: one capacityFor per service (a few small queries each); batch it if services grow past a few dozen
  const today = await Promise.all(
    services.map((s) =>
      capacityFor(s._id, todayIn(deptById.get(s.departmentId.toString())?.timezone ?? "UTC", now), now)
    )
  );

  return services.map((service, i) => {
    const dept = deptById.get(service.departmentId.toString());
    return {
      ...service,
      _id: service._id.toString(),
      departmentId: service.departmentId.toString(),
      department: dept
        ? { _id: dept._id.toString(), name: dept.name, code: dept.code, workingHours: dept.workingHours }
        : null,
      officers: officers
        .filter((o) => o.serviceIds.some((id) => id.equals(service._id)))
        .map((o) => ({ _id: o._id.toString(), name: o.name, counterNumber: o.counterNumber ?? null, isActive: o.isActive })),
      today: today[i],
    };
  });
}

// Staff (never the password hash) with department, services, counter and leave from today on
export async function employeeRows(filter: Record<string, unknown>, now: Date) {
  const employees = await Employee.find(filter).sort({ name: 1 }).lean();
  const [departments, services] = await Promise.all([
    Department.find({ _id: { $in: employees.map((e) => e.departmentId) } })
      .select("name code timezone")
      .lean(),
    Service.find({ _id: { $in: employees.flatMap((e) => e.serviceIds) } })
      .select("name code isActive")
      .lean(),
  ]);
  const deptById = new Map(departments.map((d) => [d._id.toString(), d]));
  const serviceById = new Map(services.map((s) => [s._id.toString(), s]));

  return employees.map((e) => {
    const dept = deptById.get(e.departmentId.toString());
    const today = todayIn(dept?.timezone ?? "UTC", now);
    return {
      _id: e._id.toString(),
      name: e.name,
      email: e.email,
      role: e.role,
      isActive: e.isActive,
      counterNumber: e.counterNumber ?? null,
      departmentId: e.departmentId.toString(),
      department: dept ? { _id: dept._id.toString(), name: dept.name, code: dept.code } : null,
      serviceIds: e.serviceIds.map(String),
      services: e.serviceIds.flatMap((id) => {
        const s = serviceById.get(id.toString());
        return s ? [{ _id: s._id.toString(), name: s.name, code: s.code, isActive: s.isActive }] : [];
      }),
      upcomingLeaves: e.leaves.filter((leave) => leave.to >= today).sort((a, b) => a.from.localeCompare(b.from)),
      createdAt: e.createdAt,
    };
  });
}

// ---- Cross-document checks ----

// The cutoff must fall inside the department's hours, or the service has no time to serve anyone
export function cutoffOutsideHours(cutoff: string, hours: { start: string; end: string }) {
  return cutoff <= hours.start || cutoff > hours.end
    ? fail(400, `Cutoff must be after opening (${hours.start}) and no later than closing (${hours.end})`)
    : null;
}

// An employee's services must belong to the employee's department
export async function invalidServices(departmentId: Id, serviceIds: Id[]) {
  const found = serviceIds.length ? await Service.countDocuments({ _id: { $in: serviceIds }, departmentId }) : 0;
  return found === serviceIds.length ? null : fail(400, "Pick services from the employee's own department");
}

// Officers picked on the service form must be OFFICERs of the service's department
export async function invalidOfficers(departmentId: Id, officerIds: Id[]) {
  const found = officerIds.length
    ? await Employee.countDocuments({ _id: { $in: officerIds }, departmentId, role: "OFFICER" })
    : 0;
  return found === officerIds.length ? null : fail(400, "Pick officers from this service's department");
}

// ---- Queue console ----

// Officer actions work only on today's queue of a service the officer handles
export async function todaysQueue(officer: IEmployee, queueId: Id, now: Date) {
  const queue = await ServiceQueue.findById(queueId).lean();
  if (!queue) return { queue: null, error: fail(404, "Queue not found") };
  if (!officer.serviceIds.some((id) => id.equals(queue.serviceId))) {
    return { queue: null, error: fail(403, "You don't handle this service") };
  }
  const dept = await Department.findById(queue.departmentId).select("timezone").lean();
  if (!dept || queue.date !== todayIn(dept.timezone, now)) {
    return { queue: null, error: fail(409, "Only today's queue can be changed") };
  }
  return { queue, error: null };
}
