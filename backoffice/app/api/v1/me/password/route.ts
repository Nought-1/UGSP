import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import bcrypt from "bcryptjs";
import { requireStaff } from "@/lib/auth";
import { Employee } from "@/lib/models";
import { fail, parseBody } from "@/lib/route-helpers";
import { changePasswordSchema } from "@/lib/validators";

// POST /api/v1/me/password - change your own password (any staff)
export async function POST(req: NextRequest) {
  try {
    const auth = await requireStaff();
    if (auth.error) return auth.error;

    const { data, error } = await parseBody(req, changePasswordSchema);
    if (error) return error;

    const me = await Employee.findById(auth.employee._id).select("+passwordHash");
    if (!me?.passwordHash || !(await bcrypt.compare(data.currentPassword, me.passwordHash))) {
      return fail(400, "Your current password is incorrect");
    }

    me.passwordHash = await bcrypt.hash(data.newPassword, 10);
    await me.save();
    return NextResponse.json({ success: true });
  } catch (error) {
    unstable_rethrow(error);
    console.error("POST /api/v1/me/password error:", error);
    return NextResponse.json({ error: "Failed to change password" }, { status: 500 });
  }
}
