import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Sidebar, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Signed-in shell shared by the (admin) and (officer) route groups.
// It reads no request data, so it stays in the prerendered static shell (cacheComponents):
// proxy.ts guards these routes, API routes check the session, and the role-based nav
// and user menu read the session in the browser.
export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      {/* usePathname() is request data on dynamic routes (e.g. /departments/[id]), so the nav and
          header stream in behind Suspense; the fallbacks keep the same size so nothing shifts */}
      <Suspense fallback={<Sidebar variant="inset" collapsible="icon" />}>
        <AppSidebar variant="inset" />
      </Suspense>
      {/* min-w-0: wide tables scroll inside their card instead of stretching the page */}
      <SidebarInset className="min-w-0">
        <Suspense fallback={<div className="h-14 shrink-0 border-b" />}>
          <SiteHeader />
        </Suspense>
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
