// Auto-call (no "Call next" button): a free officer is given the next checked-in citizen. Across the officer's
// OPEN queues of today, the ARRIVED token with the earliest arrival window, then the lowest number. One atomic
// claim; the {servedById, date} unique index stops a second claim (two tabs, overlapping polls) from giving one
// officer two citizens. GET /api/v1/queues calls this on every console refresh, so an open console is the
// officer's "I'm at my counter" signal (the Away switch turns it off).
import type { Types } from "mongoose";
import { CitizenToken, ServiceQueue } from "./models";
import type { IEmployee } from "./models/Employee";
import { SERVE_ORDER } from "./queue-core";

export async function dispatchNext(officer: IEmployee, openQueueIds: Types.ObjectId[], now: Date) {
  if (officer.away || openQueueIds.length === 0) return null;
  try {
    const token = await CitizenToken.findOneAndUpdate(
      { queueId: { $in: openQueueIds }, status: "ARRIVED" },
      {
        $set: {
          status: "IN_SERVICE",
          servedById: officer._id,
          startedAt: now,
          counterNumber: officer.counterNumber ?? null,
        },
      },
      { sort: SERVE_ORDER, returnDocument: "after" }
    ).lean();
    // nowServing now means "last called": windows, not numbers, decide the order
    if (token) await ServiceQueue.updateOne({ _id: token.queueId }, { $set: { nowServing: token.tokenNumber } });
    return token;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return null; // this officer already has a token in service
    throw error;
  }
}
