import { ok, handleError } from "@/lib/api";
import { listDepartments } from "@/lib/booking";

// Next 14 would otherwise pre-render this GET at build time and serve frozen data
export const dynamic = "force-dynamic";

// GET /api/v1/departments - public. Active offices (board office picker).
export async function GET() {
  try {
    return ok(await listDepartments());
  } catch (err) {
    return handleError(err, "GET /api/v1/departments");
  }
}
