import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

// Keep in sync with NAV in components/app-sidebar.tsx
const ADMIN_ONLY = ["/departments", "/services", "/employees", "/leaves"];
const OFFICER_ONLY = ["/queue"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];

const isUnder = (path: string, roots: string[]) =>
  roots.some((root) => path === root || path.startsWith(root + "/"));

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET, cookieName: SESSION_COOKIE });
  const path = req.nextUrl.pathname;
  const home = token?.role === "OFFICER" ? "/queue" : "/dashboard";
  const redirectTo = (target: string) => NextResponse.redirect(new URL(target, req.url));

  // Root and auth pages: signed-in staff go straight to their home page
  if (path === "/" || AUTH_PAGES.includes(path)) {
    if (token) return redirectTo(home);
    return path === "/" ? redirectTo("/sign-in") : NextResponse.next();
  }

  if (!token) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(signInUrl);
  }

  if (isUnder(path, ADMIN_ONLY) && token.role !== "ADMIN") return redirectTo(home);
  if (isUnder(path, OFFICER_ONLY) && token.role !== "OFFICER") return redirectTo(home);

  return NextResponse.next();
}

// Route handlers under /api check the session themselves
export const config = {
  matcher: [
    "/",
    "/sign-in",
    "/sign-up",
    "/dashboard/:path*",
    "/departments/:path*",
    "/services/:path*",
    "/employees/:path*",
    "/leaves/:path*",
    "/queue/:path*",
  ],
};
