import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { Employee } from "@/lib/models";
import { parseBody } from "@/lib/route-helpers";
import { awaySchema } from "@/lib/validators";

// PATCH /api/v1/me - {away: boolean}: an officer stepping away from the counter gets no auto-assigned citizens
// until they switch it off (OFFICER). The token they are serving is not affected.
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireStaff("OFFICER");
    if (auth.error) return auth.error;

    const { data, error } = await parseBody(req, awaySchema);
    if (error) return error;

    await Employee.updateOne({ _id: auth.employee._id }, { $set: { away: data.away } });
    return NextResponse.json({ success: true, away: data.away });
  } catch (error) {
    unstable_rethrow(error);
    console.error("PATCH /api/v1/me error:", error);
    return NextResponse.json({ error: "Failed to update your status" }, { status: 500 });
  }
}
