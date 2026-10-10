"use client";

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { useBookToken } from "@/components/booking/BookTokenModal";
import { CancelTokenDialog } from "@/components/queue/CancelTokenDialog";
import { StatusStamp } from "@/components/queue/TokenSlip";
import { useMyTokens } from "@/hooks/useToken";
import type { TokenDTO } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";
import { fmtDay, fmtTimeAt } from "@/lib/format";

type Tab = "active" | "past";

// A token as a horizontal stub: ink label block, perforation, details, stamp (+ Cancel while waiting)
function TokenRow({ token, past, onCancel }: { token: TokenDTO; past: boolean; onCancel: () => void }) {
  const { t, lang } = useT();
  return (
    <li className={clsx("relative flex overflow-hidden rounded-2xl border border-border bg-card shadow-card", past && "opacity-80")}>
      <Link href={`/citizen/tokens/${token.id}`} className="absolute inset-0 z-0" aria-label={`${t("slip.token")} ${token.label}`} />

      <div className="flex w-24 shrink-0 flex-col items-center justify-center bg-ink px-2 py-4 text-center sm:w-32">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-cream/60">{t("slip.token")}</span>
        <span className="mt-1 font-heading text-xl font-bold leading-none tabular-nums text-cream sm:text-3xl">{token.label}</span>
      </div>
      <div aria-hidden className="border-l-2 border-dashed border-border-dark" />

      <div className="min-w-0 flex-1 p-4">
        <p className="truncate text-sm font-semibold text-ink">{token.serviceName}</p>
        <p className="truncate text-xs text-muted">{token.departmentName}</p>
        <p className="mt-1.5 text-xs font-semibold text-ink">
          {fmtDay(token.date, lang)} · ~{fmtTimeAt(token.estimatedServeAt, token.timezone, lang)}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-between gap-2 p-4">
        <StatusStamp status={token.status} />
        {token.status === "WAITING" && !past && (
          <button
            type="button"
            onClick={onCancel}
            className="relative z-10 rounded-lg px-2 py-1 text-xs font-bold text-brand hover:bg-brand/5 min-h-[36px]"
          >
            {t("tokens.cancel")}
          </button>
        )}
      </div>
    </li>
  );
}

export default function MyTokensPage() {
  const { t } = useT();
  const { open: openBooking } = useBookToken();
  const [tab, setTab] = useState<Tab>("active");
  const [cancelling, setCancelling] = useState<TokenDTO | null>(null);
  const lists = { active: useMyTokens("active"), past: useMyTokens("past") };
  const current = lists[tab];

  return (
    <div className="space-y-6 py-2">
      <h1 className="reveal font-heading text-4xl font-bold text-ink sm:text-5xl">{t("tokens.title")}</h1>

      <Tabs
        activeTab={tab}
        onChange={(id) => setTab(id as Tab)}
        tabs={[
          { id: "active", label: t("tokens.upcoming"), count: lists.active.data?.length },
          { id: "past", label: t("tokens.past"), count: lists.past.data?.length },
        ]}
      />

      {current.isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {current.isError && (
        <EmptyState
          title={t("common.loadError")}
          action={<Button variant="outline" onClick={() => current.refetch()}>{t("common.retry")}</Button>}
        />
      )}

      {current.data && current.data.length === 0 && (
        <EmptyState
          title={t(tab === "active" ? "tokens.emptyUpcoming" : "tokens.emptyPast")}
          description={t(tab === "active" ? "tokens.emptyUpcomingHint" : "tokens.emptyPastHint")}
          action={
            tab === "active" ? (
              <Button onClick={openBooking} className="gap-2">
                <Ticket className="h-4 w-4" />
                {t("nav.bookToken")}
              </Button>
            ) : undefined
          }
        />
      )}

      {current.data && current.data.length > 0 && (
        <ul className="space-y-3">
          {current.data.map((token) => (
            <TokenRow key={token.id} token={token} past={tab === "past"} onCancel={() => setCancelling(token)} />
          ))}
        </ul>
      )}

      <CancelTokenDialog token={cancelling} onClose={() => setCancelling(null)} />
    </div>
  );
}
