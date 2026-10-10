import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requireStaff } from "@/lib/auth";
import { Department, Employee, Service } from "@/lib/models";
import { recomputeQueues } from "@/lib/recompute";
import { departmentPatchSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

const notFound = () => NextResponse.json({ error: "Department not found" }, { status: 404 });

async function withCounts(department: { _id: { toString(): string }; holidays: unknown[]; toObject(): object }) {
  const id = department._id.toString();
  const [servicesCount, employeesCount] = await Promise.all([
    Service.countDocuments({ departmentId: id }),
    Employee.countDocuments({ departmentId: id }),
  ]);
  return { ...department.toObject(), _id: id, holidaysCount: department.holidays.length, servicesCount, employeesCount };
}

// GET /api/v1/departments/[id] - one department with its services
export async function GET(_req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff();
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return notFound();

    const department = await Department.findById(id).lean();
    if (!department) return notFound();

    const [services, employeesCount] = await Promise.all([
      Service.find({ departmentId: id }).sort({ name: 1 }).lean(),
      Employee.countDocuments({ departmentId: id }),
    ]);

    return NextResponse.json({
      success: true,
      department: {
        ...department,
        _id: department._id.toString(),
        services: services.map((s) => ({ ...s, _id: s._id.toString(), departmentId: s.departmentId.toString() })),
        servicesCount: services.length,
        employeesCount,
        holidaysCount: department.holidays?.length ?? 0,
      },
    });
  } catch (error) {
    unstable_rethrow(error);
    console.error("GET /api/v1/departments/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch department" }, { status: 500 });
  }
}

// PATCH /api/v1/departments/[id] - update any subset of fields (ADMIN)
export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return notFound();

    const parsed = departmentPatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid department" }, { status: 400 });
    }

    const department = await Department.findById(id);
    if (!department) return notFound();

    const changes = parsed.data;
    if (changes.code && changes.code !== department.code && (await Department.exists({ code: changes.code }))) {
      return NextResponse.json({ error: `Department code '${changes.code}' is already in use` }, { status: 409 });
    }

    department.set(changes);
    await department.save();

    // Hours, days off, holidays, time zone and active all change capacity: refresh queues from today on
    const { conflicts } = await recomputeQueues({ departmentId: department._id }, new Date());

    return NextResponse.json({ success: true, department: await withCounts(department), conflicts });
  } catch (error) {
    unstable_rethrow(error);
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json({ error: "Department code already exists" }, { status: 409 });
    }
    console.error("PATCH /api/v1/departments/[id] error:", error);
    return NextResponse.json({ error: "Failed to update department" }, { status: 500 });
  }
}

// DELETE /api/v1/departments/[id] - deactivate (ADMIN). Departments are never hard-deleted:
// services, staff and past tokens point at them.
export async function DELETE(_req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return notFound();

    const department = await Department.findByIdAndUpdate(id, { isActive: false }, { returnDocument: "after" });
    if (!department) return notFound();

    // Capacity drops to 0 from today on; booked tokens are kept and reported
    const { conflicts } = await recomputeQueues({ departmentId: department._id }, new Date());

    return NextResponse.json({ success: true, department: await withCounts(department), conflicts });
  } catch (error) {
    unstable_rethrow(error);
    console.error("DELETE /api/v1/departments/[id] error:", error);
    return NextResponse.json({ error: "Failed to deactivate department" }, { status: 500 });
  }
}
