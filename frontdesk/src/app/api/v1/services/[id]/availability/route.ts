import { ok, handleError } from "@/lib/api";
import { getAvailability } from "@/lib/booking";
import { objectIdSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

// GET /api/v1/services/[id]/availability - public. Bookable days in the service's booking window.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    return ok(await getAvailability(objectIdSchema.parse(params.id)));
  } catch (err) {
    return handleError(err, "GET /api/v1/services/[id]/availability");
  }
}
