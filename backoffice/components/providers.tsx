"use client";

import { SessionProvider } from "next-auth/react";

// Light paper theme only (frontdesk "Civic" palette), so there is no theme provider
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
