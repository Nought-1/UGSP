import { dbConnect } from "@/lib/db";
import { Citizen } from "@/lib/models";
import { hashPassword } from "@/lib/auth";
import { ok, fail, handleError } from "@/lib/api";
import { signupSchema } from "@/lib/validators";

const PHONE_TAKEN = "An account with this phone number already exists";

// POST /api/v1/signup - create a citizen; the client then signs in with the same phone + password
export async function POST(req: Request) {
  try {
    const { name, phone, password, email, notifyChannels } = signupSchema.parse(
      await req.json().catch(() => null)
    );

    await dbConnect();
    if (await Citizen.exists({ phone })) {
      return fail("PHONE_TAKEN", PHONE_TAKEN, 409);
    }

    const citizen = await Citizen.create({
      name,
      phone,
      email: email || undefined,
      notifyChannels,
      passwordHash: await hashPassword(password),
    });

    return ok({ id: citizen._id.toString(), name: citizen.name, phone: citizen.phone }, 201);
  } catch (err) {
    // The unique phone index catches a concurrent signup that slipped past exists()
    if ((err as { code?: number })?.code === 11000) {
      return fail("PHONE_TAKEN", PHONE_TAKEN, 409);
    }
    return handleError(err, "POST /api/v1/signup");
  }
}
