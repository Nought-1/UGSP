import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import bcrypt from "bcryptjs";
import { requireStaff } from "@/lib/auth";
import { Employee } from "@/lib/models";
import { fail, parseBody } from "@/lib/route-helpers";
import { passwordResetSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

// POST /api/v1/employees/[id]/password - set a new password for a staff member (ADMIN).
// Sessions are stateless JWTs, so one that is already open runs out on its own (12 h at most).
export async function POST(req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return fail(404, "Employee not found");

    const { data, error } = await parseBody(req, passwordResetSchema);
    if (error) return error;

    const { matchedCount } = await Employee.updateOne(
      { _id: id },
      { $set: { passwordHash: await bcrypt.hash(data.password, 10) } }
    );
    return matchedCount ? NextResponse.json({ success: true }) : fail(404, "Employee not found");
  } catch (error) {
    unstable_rethrow(error);
    console.error("POST /api/v1/employees/[id]/password error:", error);
    return NextResponse.json({ error: "Failed to reset password" }, { status: 500 });
  }
}
