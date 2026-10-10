import { ok, handleError } from "@/lib/api";
import { listServices } from "@/lib/booking";

// Next 14 would otherwise pre-render this GET at build time and serve frozen data
export const dynamic = "force-dynamic";

// GET /api/v1/services - public. Every active service with its office (book token service picker).
export async function GET() {
  try {
    return ok(await listServices());
  } catch (err) {
    return handleError(err, "GET /api/v1/services");
  }
}
