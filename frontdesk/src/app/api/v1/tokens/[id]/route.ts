import { ok, handleError, unauthorized } from "@/lib/api";
import { getCitizenId } from "@/lib/auth";
import { cancelToken, getTokenStatus } from "@/lib/booking";
import { objectIdSchema, tokenActionSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

// GET /api/v1/tokens/[id] - live status of my token (polled every 10 s)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const citizenId = await getCitizenId();
    if (!citizenId) return unauthorized();
    return ok(await getTokenStatus(citizenId, objectIdSchema.parse(params.id)));
  } catch (err) {
    return handleError(err, "GET /api/v1/tokens/[id]");
  }
}

// PATCH /api/v1/tokens/[id] { action: "cancel" } - cancel a WAITING token. 409 NOT_CANCELLABLE
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const citizenId = await getCitizenId();
    if (!citizenId) return unauthorized();
    const tokenId = objectIdSchema.parse(params.id);
    tokenActionSchema.parse(await req.json().catch(() => null));
    return ok(await cancelToken(citizenId, tokenId));
  } catch (err) {
    return handleError(err, "PATCH /api/v1/tokens/[id]");
  }
}
