import { NextResponse } from "next/server";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { SESSION_COOKIE } from "./constants";
import { dbConnect } from "./db";
import { Employee } from "./models";
import { signInSchema } from "./validators";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Thrown messages reach the sign-in page as error codes (see SIGN_IN_ERRORS)
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) {
          throw new Error("INVALID_CREDENTIALS");
        }
        const { email, password } = parsed.data;

        const employee = await dbConnect()
          .then(() => Employee.findOne({ email }).select("+passwordHash"))
          .catch((error) => {
            console.error("Sign-in database error:", error);
            throw new Error("SERVICE_UNAVAILABLE"); // don't send driver errors to the browser
          });

        // Same answer for an unknown email and a wrong password, so accounts can't be probed
        if (!employee?.passwordHash || !(await bcrypt.compare(password, employee.passwordHash))) {
          throw new Error("INVALID_CREDENTIALS");
        }

        if (!employee.isActive) {
          throw new Error("INACTIVE_ACCOUNT");
        }

        return {
          id: employee._id.toString(),
          name: employee.name,
          email: employee.email,
          role: employee.role,
          departmentId: employee.departmentId ? employee.departmentId.toString() : "",
          serviceIds: Array.isArray(employee.serviceIds)
            ? employee.serviceIds.map((id) => id.toString())
            : [],
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.serviceIds = user.serviceIds;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        if (token.role) session.user.role = token.role;
        if (token.departmentId) session.user.departmentId = token.departmentId;
        if (token.serviceIds) session.user.serviceIds = token.serviceIds;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
  // One working day: staff sign in again each morning (counters are shared PCs)
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: SESSION_COOKIE,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const deny = (status: 401 | 403, error: string) => ({ employee: null, error: NextResponse.json({ error }, { status }) });

// Every API route calls this. The proxy doesn't guard /api, and the JWT can be up to 12h stale,
// so the employee (role, isActive, serviceIds) is re-read from the database on each request.
export async function requireStaff(role?: "ADMIN" | "OFFICER") {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return deny(401, "Unauthorized");

  await dbConnect();
  const employee = await Employee.findById(session.user.id);
  if (!employee?.isActive) return deny(401, "Unauthorized");
  if (role && employee.role !== role) return deny(403, `Forbidden: ${role} role required`);

  return { employee, error: null };
}
