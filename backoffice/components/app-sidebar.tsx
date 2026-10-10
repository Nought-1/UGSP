"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Building2,
  CalendarDays,
  Cog,
  LayoutDashboard,
  ListOrdered,
  Users,
  type LucideIcon,
} from "lucide-react";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

type Role = "ADMIN" | "OFFICER";

interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  roles: Role[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// Single source for the sidebar and the header breadcrumb. Keep in sync with proxy.ts role checks.
export const NAV: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN", "OFFICER"] }],
  },
  {
    label: "Operations",
    items: [{ title: "Queue console", url: "/queue", icon: ListOrdered, roles: ["OFFICER"] }],
  },
  {
    label: "Configuration",
    items: [
      { title: "Departments", url: "/departments", icon: Building2, roles: ["ADMIN"] },
      { title: "Services", url: "/services", icon: Cog, roles: ["ADMIN"] },
      { title: "Employees", url: "/employees", icon: Users, roles: ["ADMIN"] },
      { title: "Leave", url: "/leaves", icon: CalendarDays, roles: ["ADMIN"] },
    ],
  },
];

export function findNav(pathname: string) {
  for (const section of NAV) {
    for (const item of section.items) {
      if (pathname === item.url || pathname.startsWith(item.url + "/")) return { section, item };
    }
  }
  return null;
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  // required: an expired session (12h maxAge) sends the user back to /sign-in
  const { data: session } = useSession({ required: true });
  const role = session?.user.role;
  const active = findNav(pathname)?.item;
  const sections = role
    ? NAV.map((section) => ({
        ...section,
        items: section.items.filter((item) => item.roles.includes(role)),
      })).filter((section) => section.items.length > 0)
    : [];

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              {/* The mark is the brand's rubber stamp, as on the sign-in page */}
              <div className="flex aspect-square size-8 items-center justify-center bg-brand font-heading text-sm font-bold text-brand-foreground">
                UG
              </div>
              <div className="grid flex-1 gap-0.5 text-left leading-tight">
                <span className="truncate font-heading text-base font-semibold tracking-wide uppercase">UGSP</span>
                <span className="micro-label truncate">Backoffice</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {!role && (
          // Not SidebarMenuSkeleton: its Math.random() width breaks prerendering and hydration
          <SidebarGroup>
            <SidebarMenu>
              {Array.from({ length: 4 }, (_, i) => (
                <SidebarMenuItem key={i}>
                  <Skeleton className="h-8 w-full" />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={item === active}
                      tooltip={item.title}
                      render={<Link href={item.url} />}
                      className="data-active:shadow-[inset_2px_0_0_var(--color-ink)]"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
