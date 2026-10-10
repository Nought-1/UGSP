import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requireStaff } from "@/lib/auth";
import { Department, Employee } from "@/lib/models";
import { recomputeQueues } from "@/lib/recompute";
import { employeeRows, fail, invalidServices, parseBody } from "@/lib/route-helpers";
import { employeePatchSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

const notFound = () => fail(404, "Employee not found");

// PATCH /api/v1/employees/[id] - update any subset of profile, role, services, counter or active (ADMIN)
export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return notFound();

    const { data: changes, error } = await parseBody(req, employeePatchSchema);
    if (error) return error;

    const employee = await Employee.findById(id);
    if (!employee) return notFound();

    // Admins can't lock themselves out. The caller stays an active ADMIN, so this also keeps the last admin.
    if (employee._id.equals(auth.employee._id)) {
      if (changes.role === "OFFICER") return fail(409, "You can't remove your own admin role");
      if (changes.isActive === false) return fail(409, "You can't deactivate your own account");
    }
    if (changes.departmentId && !(await Department.exists({ _id: changes.departmentId }))) {
      return fail(400, "Department not found");
    }
    if (changes.departmentId || changes.serviceIds) {
      const badServices = await invalidServices(
        changes.departmentId ?? employee.departmentId,
        changes.serviceIds ?? employee.serviceIds
      );
      if (badServices) return badServices;
    }
    if (changes.email && changes.email !== employee.email && (await Employee.exists({ email: changes.email }))) {
      return fail(409, `${changes.email} already has an account`);
    }

    const before = employee.serviceIds.map(String);
    const { counterNumber, ...rest } = changes;
    employee.set(rest);
    if (counterNumber !== undefined) employee.counterNumber = counterNumber ?? undefined; // null clears the counter
    await employee.save();

    // Services, role and active change who can serve: refresh the old and the new services' queues
    const now = new Date();
    const serviceIds = [...new Set([...before, ...employee.serviceIds.map(String)])];
    const { conflicts } = await recomputeQueues({ serviceIds }, now);
    const [row] = await employeeRows({ _id: employee._id }, now);

    return NextResponse.json({ success: true, employee: row, conflicts });
  } catch (error) {
    unstable_rethrow(error);
    if ((error as { code?: number }).code === 11000) return fail(409, "This email already has an account");
    console.error("PATCH /api/v1/employees/[id] error:", error);
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}
