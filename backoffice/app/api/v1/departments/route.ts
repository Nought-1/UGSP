import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Department, Employee, Service } from "@/lib/models";
import { departmentSchema } from "@/lib/validators";

const countsByDepartment = (rows: { _id: unknown; count: number }[]) =>
  new Map(rows.map((row) => [String(row._id), row.count]));

// GET /api/v1/departments - departments with service, staff and holiday counts (?includeInactive=true)
export async function GET(req: NextRequest) {
  try {
    const auth = await requireStaff();
    if (auth.error) return auth.error;

    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true";
    const [departments, serviceCounts, employeeCounts] = await Promise.all([
      Department.find(includeInactive ? {} : { isActive: true }).sort({ name: 1 }).lean(),
      Service.aggregate([{ $group: { _id: "$departmentId", count: { $sum: 1 } } }]),
      Employee.aggregate([{ $group: { _id: "$departmentId", count: { $sum: 1 } } }]),
    ]);
    const services = countsByDepartment(serviceCounts);
    const employees = countsByDepartment(employeeCounts);

    return NextResponse.json({
      success: true,
      departments: departments.map((dept) => {
        const id = dept._id.toString();
        return {
          ...dept,
          _id: id,
          holidaysCount: dept.holidays?.length ?? 0,
          servicesCount: services.get(id) ?? 0,
          employeesCount: employees.get(id) ?? 0,
        };
      }),
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("GET /api/v1/departments error:", error);
    return NextResponse.json({ error: "Failed to fetch departments" }, { status: 500 });
  }
}

// POST /api/v1/departments - create a department (ADMIN)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const parsed = departmentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid department" }, { status: 400 });
    }
    // Codes are stored upper-cased, so an exact match is enough (no RegExp built from user input)
    if (await Department.exists({ code: parsed.data.code })) {
      return NextResponse.json({ error: `Department code '${parsed.data.code}' already exists` }, { status: 409 });
    }

    const department = await Department.create(parsed.data);
    return NextResponse.json(
      {
        success: true,
        department: {
          ...department.toObject(),
          _id: department._id.toString(),
          holidaysCount: department.holidays.length,
          servicesCount: 0,
          employeesCount: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    unstable_rethrow(error);
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Department code already exists" }, { status: 409 });
    }
    console.error("POST /api/v1/departments error:", error);
    return NextResponse.json({ error: "Failed to create department" }, { status: 500 });
  }
}
