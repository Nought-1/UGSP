import { withAuth } from "next-auth/middleware";
import { SESSION_COOKIE } from "@/lib/constants";

// Citizen pages need a session; signed-out users are sent to /login?callbackUrl=...
// Everything else (landing, login, signup, API) is public; API routes check the session themselves.
export default withAuth({
  pages: { signIn: "/login" },
  cookies: { sessionToken: { name: SESSION_COOKIE } },
});

export const config = {
  matcher: ["/citizen/:path*"],
};
