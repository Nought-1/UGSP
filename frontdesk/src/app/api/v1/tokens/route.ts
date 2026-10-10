import { ok, handleError, unauthorized } from "@/lib/api";
import { getCitizenId } from "@/lib/auth";
import { bookToken, listMyTokens } from "@/lib/booking";
import { bookSchema, tokenListQuery } from "@/lib/validators";

export const dynamic = "force-dynamic";

// GET /api/v1/tokens?status=active|past - my tokens
export async function GET(req: Request) {
  try {
    const citizenId = await getCitizenId();
    if (!citizenId) return unauthorized();
    const { status } = tokenListQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
    return ok(await listMyTokens(citizenId, status));
  } catch (err) {
    return handleError(err, "GET /api/v1/tokens");
  }
}

// POST /api/v1/tokens { serviceId, date } - book a token.
// 201 TokenDTO · 409 DATE_NOT_BOOKABLE | DATE_FULL | ALREADY_BOOKED (with tokenId)
export async function POST(req: Request) {
  try {
    const citizenId = await getCitizenId();
    if (!citizenId) return unauthorized();
    const { serviceId, date } = bookSchema.parse(await req.json().catch(() => null));
    return ok(await bookToken(citizenId, serviceId, date), 201);
  } catch (err) {
    return handleError(err, "POST /api/v1/tokens");
  }
}
