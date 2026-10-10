import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { dbConnect } from "./db";
import { Citizen } from "./models";
import { loginSchema } from "./validators";
import { SESSION_COOKIE } from "./constants";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number
) => Promise<Buffer>;

// Stored as "scrypt$<salt hex>$<hash hex>"
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split("$");
  if (algo !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(actual, expected);
}

const secure = process.env.NEXTAUTH_URL?.startsWith("https://") ?? false;
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, path: "/", secure };

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Phone",
      credentials: {
        phone: { label: "Phone", type: "tel" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        await dbConnect();
        const citizen = await Citizen.findOne({ phone: parsed.data.phone }).select("+passwordHash");
        if (!citizen || !(await verifyPassword(parsed.data.password, citizen.passwordHash))) {
          return null; // same answer for unknown phone and wrong password
        }

        return {
          id: citizen._id.toString(),
          name: citizen.name,
          email: citizen.email ?? null,
          phone: citizen.phone,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.phone = user.phone;
      return token;
    },
    session({ session, token }) {
      if (token.sub) {
        session.user.id = token.sub;
        session.user.phone = token.phone ?? "";
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // fd.* names so backoffice's next-auth.* cookies on the same localhost don't overwrite ours
  cookies: {
    sessionToken: { name: SESSION_COOKIE, options: cookieOptions },
    csrfToken: { name: "fd.csrf-token", options: cookieOptions },
    callbackUrl: { name: "fd.callback-url", options: { sameSite: "lax", path: "/", secure } },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Citizen _id of the signed-in user, or null. API routes return 401 on null.
export async function getCitizenId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id ?? null;
}
