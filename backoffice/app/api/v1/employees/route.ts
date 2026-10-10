import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import bcrypt from "bcryptjs";
import { requireStaff } from "@/lib/auth";
import { Department, Employee } from "@/lib/models";
import { recomputeQueues } from "@/lib/recompute";
import { employeeRows, fail, invalidServices, parseBody } from "@/lib/route-helpers";
import { employeeSchema } from "@/lib/validators";

// GET /api/v1/employees - staff with services, counter and upcoming leave (ADMIN)
//   ?departmentId=   ?role=ADMIN|OFFICER
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const params = req.nextUrl.searchParams;
    const departmentId = params.get("departmentId");
    const role = params.get("role");
    if (departmentId && !isValidObjectId(departmentId)) return fail(400, "Invalid departmentId");
    if (role && role !== "ADMIN" && role !== "OFFICER") return fail(400, "role must be ADMIN or OFFICER");

    const filter: Record<string, unknown> = {};
    if (departmentId) filter.departmentId = departmentId;
    if (role) filter.role = role;

    return NextResponse.json({ success: true, employees: await employeeRows(filter, new Date()) });
  } catch (error) {
    unstable_rethrow(error);
    console.error("GET /api/v1/employees error:", error);
    return NextResponse.json({ error: "Failed to fetch employees" }, { status: 500 });
  }
}

// POST /api/v1/employees - create a staff account with the password the admin typed (ADMIN)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { data, error } = await parseBody(req, employeeSchema);
    if (error) return error;
    const { password, ...fields } = data;

    if (!(await Department.exists({ _id: fields.departmentId }))) return fail(400, "Department not found");
    const badServices = await invalidServices(fields.departmentId, fields.serviceIds);
    if (badServices) return badServices;
    if (await Employee.exists({ email: fields.email })) return fail(409, `${fields.email} already has an account`);

    const employee = await Employee.create({
      ...fields,
      counterNumber: fields.counterNumber ?? undefined, // null: no counter
      passwordHash: await bcrypt.hash(password, 10),
    });

    // A new officer adds capacity to the queues of their services
    const now = new Date();
    const { conflicts } = await recomputeQueues({ serviceIds: employee.serviceIds }, now);
    const [row] = await employeeRows({ _id: employee._id }, now);

    return NextResponse.json({ success: true, employee: row, conflicts }, { status: 201 });
  } catch (error) {
    unstable_rethrow(error);
    if ((error as { code?: number }).code === 11000) return fail(409, "This email already has an account");
    console.error("POST /api/v1/employees error:", error);
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
}
