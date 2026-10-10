"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, Ticket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBookToken } from "@/components/booking/BookTokenModal";
import { LivePanel } from "@/components/queue/LivePanel";
import { OfficeInfo } from "@/components/queue/OfficeInfo";
import { StatusStamp } from "@/components/queue/TokenSlip";
import { useMyTokens, useTokenStatus } from "@/hooks/useToken";
import { useT } from "@/lib/i18n";
import { fmtDay, fmtToday } from "@/lib/format";

export default function CitizenDashboardPage() {
  const { t, lang } = useT();
  const { open: openBooking } = useBookToken();
  const user = useSession().data?.user;
  const active = useMyTokens("active");
  const next = active.data?.[0];
  const live = useTokenStatus(next?.id);
  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-6 py-2">
      <header className="reveal flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="micro-label">{fmtToday(lang)}</p>
          <h1 className="mt-1 font-heading text-4xl font-bold text-ink sm:text-5xl">{t("dash.greeting", { name: firstName })}</h1>
        </div>
        <Button size="lg" onClick={openBooking} className="gap-2">
          <Ticket className="h-5 w-5" />
          {t("nav.bookToken")}
        </Button>
      </header>

      {active.isLoading && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-80 lg:col-span-8" />
          <Skeleton className="h-64 lg:col-span-4" />
        </div>
      )}

      {active.isError && (
        <EmptyState
          title={t("common.loadError")}
          action={<Button variant="outline" onClick={() => active.refetch()}>{t("common.retry")}</Button>}
        />
      )}

      {active.data && !next && (
        // A blank slip outline as the empty state
        <div className="reveal mx-auto max-w-md rounded-[1.25rem] border-2 border-dashed border-border-dark bg-card/60 p-8 text-center" style={{ animationDelay: "60ms" }}>
          <div className="micro-label">{t("slip.token")}</div>
          <div className="mt-2 font-heading text-6xl font-bold text-border-dark">— — —</div>
          <h2 className="mt-5 font-heading text-2xl font-bold text-ink">{t("dash.empty")}</h2>
          <p className="mt-1 text-sm text-muted">{t("dash.emptyHint")}</p>
          <Button onClick={openBooking} className="mt-5 gap-2">
            <Ticket className="h-4 w-4" />
            {t("nav.bookToken")}
          </Button>
        </div>
      )}

      {next && (
        <div className="grid gap-6 lg:grid-cols-12">
          <Link
            href={`/citizen/tokens/${next.id}`}
            className="reveal group block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors hover:border-ink/40 lg:col-span-8"
            style={{ animationDelay: "60ms" }}
          >
            <div className="grid md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              {/* Slip panel */}
              <div className="order-2 border-t border-dashed border-border-dark p-5 md:order-1 md:border-r md:border-t-0">
                <div className="micro-label">{t("dash.yourNext")}</div>
                <div className="mt-2 font-heading text-6xl font-bold leading-none tracking-[-0.03em] tabular-nums text-ink">
                  {next.label}
                </div>
                <p className="mt-3 text-sm font-semibold text-ink">{next.serviceName}</p>
                <p className="text-sm text-muted">{next.departmentName}</p>
                <p className="mt-1 text-sm text-muted">{fmtDay(next.date, lang, { weekday: "long", day: "numeric", month: "long" })}</p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <StatusStamp status={next.status} />
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-brand group-hover:underline">
                    {t("dash.viewStatus")}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>

              {/* Live panel */}
              <div className="order-1 p-5 md:order-2">
                {live.data ? <LivePanel status={live.data} updatedAt={live.dataUpdatedAt} /> : <Skeleton className="h-64" />}
              </div>
            </div>
          </Link>

          <div className="reveal space-y-4 lg:col-span-4" style={{ animationDelay: "120ms" }}>
            {live.data ? <OfficeInfo office={live.data.office} /> : <Skeleton className="h-56" />}
            {active.data && active.data.length > 1 && (
              <Link href="/citizen/history" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">
                {t("dash.more", { n: active.data.length - 1 })}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
