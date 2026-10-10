import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requireStaff } from "@/lib/auth";
import { Employee } from "@/lib/models";
import { recomputeQueues } from "@/lib/recompute";
import { fail, parseBody } from "@/lib/route-helpers";
import { leaveSchema, ymd } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

const notFound = () => fail(404, "Employee not found");

// POST /api/v1/employees/[id]/leaves - add leave {from, to, reason}; days are inclusive (ADMIN)
export async function POST(req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return notFound();

    const { data, error } = await parseBody(req, leaveSchema);
    if (error) return error;
    const leave = { from: data.from, to: data.to, ...(data.reason ? { reason: data.reason } : {}) };

    // One atomic step: added only when it overlaps no other leave of this employee
    const employee = await Employee.findOneAndUpdate(
      { _id: id, leaves: { $not: { $elemMatch: { from: { $lte: data.to }, to: { $gte: data.from } } } } },
      { $push: { leaves: { $each: [leave], $sort: { from: 1 } } } },
      { returnDocument: "after" }
    ).lean();
    if (!employee) {
      return (await Employee.exists({ _id: id })) ? fail(409, "This overlaps other leave of this employee") : notFound();
    }

    // Fewer officers on those days: refresh those queues
    const { conflicts } = await recomputeQueues(
      { serviceIds: employee.serviceIds, from: data.from, to: data.to },
      new Date()
    );
    return NextResponse.json({ success: true, leaves: employee.leaves, conflicts }, { status: 201 });
  } catch (error) {
    unstable_rethrow(error);
    console.error("POST /api/v1/employees/[id]/leaves error:", error);
    return NextResponse.json({ error: "Failed to add leave" }, { status: 500 });
  }
}

// DELETE /api/v1/employees/[id]/leaves?from=YYYY-MM-DD - remove the leave starting that day (ADMIN)
export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("ADMIN");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return notFound();

    const from = req.nextUrl.searchParams.get("from") ?? "";
    if (!ymd.safeParse(from).success) return fail(400, "from must be a YYYY-MM-DD date");

    const before = await Employee.findOneAndUpdate(
      { _id: id, "leaves.from": from },
      { $pull: { leaves: { from } } },
      { returnDocument: "before" }
    ).lean();
    const removed = before?.leaves.find((leave) => leave.from === from);
    if (!before || !removed) return fail(404, "Leave not found");

    const { conflicts } = await recomputeQueues(
      { serviceIds: before.serviceIds, from: removed.from, to: removed.to },
      new Date()
    );
    return NextResponse.json({ success: true, conflicts });
  } catch (error) {
    unstable_rethrow(error);
    console.error("DELETE /api/v1/employees/[id]/leaves error:", error);
    return NextResponse.json({ error: "Failed to remove leave" }, { status: 500 });
  }
}
