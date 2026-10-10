import { NextRequest, NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { requireStaff } from "@/lib/auth";
import { CitizenToken, ServiceQueue } from "@/lib/models";
import { notify } from "@/lib/notifier";
import { releaseSlot } from "@/lib/queue-core";
import { fail, parseBody, todaysQueue } from "@/lib/route-helpers";
import { tokenActionSchema } from "@/lib/validators";

type Context = { params: Promise<{ id: string }> };

const notFound = () => fail(404, "Token not found");
const statusText = (status: string) => status.toLowerCase().replace("_", " ");

// PATCH /api/v1/tokens/[id] - {action: arrive | complete | no_show | cancel | come_early} on a token of today
// (OFFICER). Each action is one guarded update, so a stale screen or a double click gets 409 instead of a wrong
// state. Nobody is "called" here: the console's next refresh gives a free officer the next checked-in citizen.
export async function PATCH(req: NextRequest, { params }: Context) {
  try {
    const auth = await requireStaff("OFFICER");
    if (auth.error) return auth.error;
    const me = auth.employee;

    const { id } = await params;
    if (!isValidObjectId(id)) return notFound();

    const { data, error } = await parseBody(req, tokenActionSchema);
    if (error) return error;

    const token = await CitizenToken.findById(id)
      .select("queueId status slotStart citizenId serviceId tokenNumber comeEarlyAt")
      .lean();
    if (!token) return notFound();

    const now = new Date();
    const { queue, error: denied } = await todaysQueue(me, token.queueId, now);
    if (denied) return denied;

    // Ask a booked citizen who isn't here yet to come now (logged like the other alerts; frontdesk shows a banner)
    if (data.action === "come_early") {
      if (queue.status !== "OPEN") return fail(409, `The queue is ${statusText(queue.status)}`);
      if (token.status !== "WAITING") return fail(409, `The token is ${statusText(token.status)}`);
      const logged = await notify([token], "COME_EARLY", now, { status: "WAITING", comeEarlyAt: { $exists: false } });
      if (!logged) return fail(409, token.comeEarlyAt ? "Already asked to come now" : "The token just changed. Refresh.");
      return NextResponse.json({ success: true, token: { _id: token._id, status: "WAITING", comeEarlyAt: now } });
    }

    const rules: Record<
      Exclude<typeof data.action, "come_early">,
      { guard: Record<string, unknown>; set: Record<string, unknown> }
    > = {
      arrive: { guard: { status: "WAITING" }, set: { status: "ARRIVED", arrivedAt: now } },
      complete: { guard: { status: "IN_SERVICE", servedById: me._id }, set: { status: "COMPLETED", completedAt: now } },
      // Also my own in-service token: the citizen I was given never came to the counter
      no_show: {
        guard: { $or: [{ status: { $in: ["WAITING", "ARRIVED"] } }, { status: "IN_SERVICE", servedById: me._id }] },
        set: { status: "NO_SHOW" },
      },
      cancel: { guard: { status: "WAITING" }, set: { status: "CANCELLED" } },
    };
    const rule = rules[data.action];
    const updated = await CitizenToken.findOneAndUpdate(
      { _id: token._id, ...rule.guard },
      { $set: rule.set },
      { returnDocument: "after" }
    ).lean();
    if (!updated) {
      const servedByOther = data.action === "complete" && token.status === "IN_SERVICE";
      return fail(409, servedByOther ? "Another officer is serving this token" : `The token is ${statusText(token.status)}`);
    }

    // Counters: a completion counts once; a cancellation gives its seat back (day and window)
    if (data.action === "complete") await ServiceQueue.updateOne({ _id: queue._id }, { $inc: { completedCount: 1 } });
    if (data.action === "cancel") await releaseSlot(queue._id, token.slotStart);

    return NextResponse.json({ success: true, token: updated });
  } catch (error) {
    unstable_rethrow(error);
    console.error("PATCH /api/v1/tokens/[id] error:", error);
    return NextResponse.json({ error: "Failed to update token" }, { status: 500 });
  }
}
