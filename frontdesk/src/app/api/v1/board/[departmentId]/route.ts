import { ok, handleError } from "@/lib/api";
import { getBoard } from "@/lib/booking";
import { objectIdSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

// GET /api/v1/board/[departmentId] - public. Today's now-serving per service (office TV board).
export async function GET(_req: Request, { params }: { params: { departmentId: string } }) {
  try {
    return ok(await getBoard(objectIdSchema.parse(params.departmentId)));
  } catch (err) {
    return handleError(err, "GET /api/v1/board/[departmentId]");
  }
}
