import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requireStaff } from "@/lib/auth";
import { ServiceQueue } from "@/lib/models";
import { fail, parseBody, todaysQueue } from "@/lib/route-helpers";
import { queueActionSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

// PAUSED: no calls and no "arrive soon" alerts. CLOSED: also no bookings.
const TRANSITIONS = {
  pause: { from: ["OPEN"], to: "PAUSED" },
  open: { from: ["PAUSED", "CLOSED"], to: "OPEN" },
  close: { from: ["OPEN", "PAUSED"], to: "CLOSED" },
} as const;

// PATCH /api/v1/queues/[id] - {action: pause | open | close} on today's queue (OFFICER)
export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("OFFICER");
    if (auth.error) return auth.error;

    const { id } = await params;
    if (!isValidObjectId(id)) return fail(404, "Queue not found");

    const { data, error } = await parseBody(req, queueActionSchema);
    if (error) return error;

    const { queue, error: denied } = await todaysQueue(auth.employee, id, new Date());
    if (denied) return denied;

    const move = TRANSITIONS[data.action];
    const updated = await ServiceQueue.findOneAndUpdate(
      { _id: queue._id, status: { $in: move.from } },
      { $set: { status: move.to } },
      { returnDocument: "after" }
    ).lean();
    if (!updated) return fail(409, `Can't ${data.action} a queue that is ${queue.status.toLowerCase()}`);

    return NextResponse.json({ success: true, queue: updated });
  } catch (error) {
    unstable_rethrow(error);
    console.error("PATCH /api/v1/queues/[id] error:", error);
    return NextResponse.json({ error: "Failed to update queue" }, { status: 500 });
  }
}
