import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; phone: string };
  }
  interface User {
    phone: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    phone?: string;
  }
}
