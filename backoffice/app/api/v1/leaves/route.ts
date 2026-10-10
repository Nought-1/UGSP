import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requireStaff } from "@/lib/auth";
import { Department, Employee, Service } from "@/lib/models";
import { todayIn } from "@/lib/queue-core";
import { fail } from "@/lib/route-helpers";
import { ymd } from "@/lib/validators";

// GET /api/v1/leaves - leave across staff that ends on or after `from`, by start date (ADMIN)
//   ?departmentId=   ?from=YYYY-MM-DD (default: today in each employee's department)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const params = req.nextUrl.searchParams;
    const departmentId = params.get("departmentId");
    const from = params.get("from");
    if (departmentId && !isValidObjectId(departmentId)) return fail(400, "Invalid departmentId");
    if (from && !ymd.safeParse(from).success) return fail(400, "from must be a YYYY-MM-DD date");

    const filter: Record<string, unknown> = { "leaves.0": { $exists: true } };
    if (departmentId) filter.departmentId = departmentId;
    const employees = await Employee.find(filter).select("name role isActive departmentId serviceIds leaves").lean();

    const [departments, services] = await Promise.all([
      Department.find({ _id: { $in: employees.map((e) => e.departmentId) } })
        .select("name code timezone")
        .lean(),
      Service.find({ _id: { $in: employees.flatMap((e) => e.serviceIds) } })
        .select("name code")
        .lean(),
    ]);
    const deptById = new Map(departments.map((d) => [d._id.toString(), d]));
    const serviceById = new Map(services.map((s) => [s._id.toString(), s]));

    const now = new Date();
    const leaves = employees
      .flatMap((e) => {
        const dept = deptById.get(e.departmentId.toString());
        const since = from ?? todayIn(dept?.timezone ?? "UTC", now);
        return e.leaves
          .filter((leave) => leave.to >= since)
          .map((leave) => ({
            employeeId: e._id.toString(),
            employeeName: e.name,
            role: e.role,
            isActive: e.isActive,
            department: dept ? { _id: dept._id.toString(), name: dept.name, code: dept.code } : null,
            services: e.serviceIds.flatMap((id) => {
              const s = serviceById.get(id.toString());
              return s ? [{ _id: s._id.toString(), name: s.name, code: s.code }] : [];
            }),
            from: leave.from,
            to: leave.to,
            reason: leave.reason ?? "",
          }));
      })
      .sort((a, b) => a.from.localeCompare(b.from) || a.employeeName.localeCompare(b.employeeName));

    return NextResponse.json({ success: true, leaves });
  } catch (error) {
    unstable_rethrow(error);
    console.error("GET /api/v1/leaves error:", error);
    return NextResponse.json({ error: "Failed to fetch leaves" }, { status: 500 });
  }
}
