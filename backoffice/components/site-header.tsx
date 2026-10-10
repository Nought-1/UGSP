"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { findNav } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

// "SAT · 10 OCT 2026" (the micro-label style uppercases it)
function formatToday(date: Date) {
  const parts = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => ({ ...acc, [part.type]: part.value }), {});
  return `${parts.weekday} · ${parts.day} ${parts.month} ${parts.year}`;
}

export function SiteHeader() {
  const pathname = usePathname();
  const role = useSession().data?.user.role;
  const nav = findNav(pathname);
  const isDetail = nav !== null && pathname !== nav.item.url; // e.g. /departments/[id]

  // Client-only: reading the clock during render breaks prerendering (cacheComponents)
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setToday(formatToday(new Date())), 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
      <Breadcrumb>
        <BreadcrumbList>
          {nav ? (
            <>
              <BreadcrumbItem className="hidden md:block">{nav.section.label}</BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              {isDetail ? (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink render={<Link href={nav.item.url} />}>{nav.item.title}</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Details</BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  <BreadcrumbPage>{nav.item.title}</BreadcrumbPage>
                </BreadcrumbItem>
              )}
            </>
          ) : (
            <BreadcrumbItem>
              <BreadcrumbPage>Backoffice</BreadcrumbPage>
            </BreadcrumbItem>
          )}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-4">
        {today && <span className="micro-label hidden sm:inline">{today}</span>}
        {role && <span className="stamp border-ink text-ink">{role === "ADMIN" ? "Admin" : "Officer"}</span>}
      </div>
    </header>
  );
}
