import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { Department, Employee } from "@/lib/models";
import { setupSchema } from "@/lib/validators";

// First-run setup only: creates the first department and its ADMIN.
// After that, staff accounts are created by an ADMIN through the employees API.
async function isFirstRun() {
  return (await Employee.countDocuments({ role: "ADMIN" })) === 0;
}

// GET /api/signup - is first-time setup still open?
export async function GET() {
  try {
    await dbConnect();
    return NextResponse.json({ isFirstTimeSetup: await isFirstRun() });
  } catch (error) {
    unstable_rethrow(error); // let Next see dynamic-route signals instead of caching a 500
    console.error("GET /api/signup error:", error);
    return NextResponse.json({ error: "Failed to check setup status" }, { status: 500 });
  }
}

// POST /api/signup - create the first ADMIN and department
export async function POST(req: NextRequest) {
  try {
    const parsed = setupSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid details" },
        { status: 400 }
      );
    }
    const { name, email, password, departmentName, departmentCode } = parsed.data;

    await dbConnect();
    // ponytail: check-then-create; two simultaneous first-run requests could both pass (fine for a one-off setup)
    if (!(await isFirstRun())) {
      return NextResponse.json(
        { error: "Setup is already complete. Ask an administrator for an account." },
        { status: 403 }
      );
    }
    if (await Employee.exists({ email })) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    // Reuse the department if the code exists already (for example from the seed script)
    const department =
      (await Department.findOne({ code: departmentCode })) ??
      (await Department.create({
        name: departmentName,
        code: departmentCode,
        workingHours: { start: "09:00", end: "17:00" },
        weekOffDays: [0, 6],
        holidays: [],
        timezone: "Asia/Kolkata",
        isActive: true,
      }));

    const employee = await Employee.create({
      departmentId: department._id,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: "ADMIN",
      serviceIds: [],
      leaves: [],
      isActive: true,
    });

    return NextResponse.json(
      { success: true, user: { id: employee._id.toString(), email: employee.email } },
      { status: 201 }
    );
  } catch (error) {
    unstable_rethrow(error); // let Next see dynamic-route signals instead of caching a 500
    console.error("POST /api/signup error:", error);
    return NextResponse.json({ error: "Failed to complete setup" }, { status: 500 });
  }
}
