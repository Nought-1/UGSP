"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import type { TokenStatusDTO } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";
import { fmtDay, fmtTimeAt, todayInZone, tokenLabel } from "@/lib/format";
import { isFinal } from "@/hooks/useToken";
import { LiveBadge } from "./LiveBadge";
import { QueueRail } from "./QueueRail";
import { StatTile } from "./StatTile";

type Tone = "brand" | "ink" | "amber" | "red";

const TONES: Record<Tone, string> = {
  brand: "border-brand bg-brand text-white",
  ink: "border-ink bg-ink text-cream",
  amber: "border-status-pending-border bg-status-pending-bg text-status-pending-text",
  red: "border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled-text",
};

function Banner({ tone, children, pulse }: { tone: Tone; children: ReactNode; pulse?: boolean }) {
  return (
    <div className={clsx("flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold", TONES[tone])}>
      {pulse && (
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
        </span>
      )}
      <span>{children}</span>
    </div>
  );
}

// The answer to "how long, and when?": wait, ETA, queue rail and the three figures, plus turn and queue banners
export function LivePanel({ status, updatedAt }: { status: TokenStatusDTO; updatedAt: number }) {
  const { t, lang } = useT();
  const { token, office } = status;
  const eta = fmtTimeAt(status.liveEtaAt, office.timezone, lang);

  if (isFinal(token.status)) {
    return (
      <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
        <LiveBadge updatedAt={updatedAt} paused />
        <p className="font-heading text-3xl font-bold text-ink">
          {t("token.final", { status: t(`status.${token.status}` as const) })}
        </p>
      </section>
    );
  }

  const isToday = token.date === todayInZone(office.timezone);

  return (
    <section className="space-y-4" aria-live="polite">
      <LiveBadge updatedAt={updatedAt} />

      {token.status === "IN_SERVICE" && (
        <Banner tone="brand" pulse>
          {status.counterNumber ? t("token.yourTurnCounter", { n: status.counterNumber }) : t("token.yourTurn")}
        </Banner>
      )}
      {token.status === "ARRIVED" && <Banner tone="ink">{t("token.arrived")}</Banner>}
      {status.queueStatus === "PAUSED" && <Banner tone="amber">{t("token.paused")}</Banner>}
      {status.queueStatus === "CLOSED" && <Banner tone="red">{t("token.closed")}</Banner>}

      {isToday ? (
        <>
          <div>
            <div key={status.waitMin} className="animate-fade-in font-heading text-6xl font-bold leading-none tabular-nums text-ink">
              {t("dash.wait", { n: status.waitMin })}
            </div>
            <p className="mt-1.5 text-sm font-semibold text-muted">{t("dash.at", { time: eta })}</p>
          </div>
          <QueueRail nowServing={status.nowServing} peopleAhead={status.peopleAhead} serviceCode={token.serviceCode} />
          <div className="grid grid-cols-3 gap-2">
            <StatTile label={t("stat.position")} value={status.position} />
            <StatTile label={t("stat.ahead")} value={status.peopleAhead} />
            <StatTile
              label={t("stat.nowServing")}
              value={status.nowServing > 0 ? tokenLabel(token.serviceCode, status.nowServing) : "—"}
            />
          </div>
        </>
      ) : (
        // A future day: the queue hasn't started, so no rail; show when and how many booked earlier
        <div className="rounded-xl border border-dashed border-border-dark bg-cream/50 p-4">
          <p className="font-heading text-2xl font-bold leading-tight text-ink">
            {t("dash.notToday", {
              date: fmtDay(token.date, lang, { weekday: "long", day: "numeric", month: "long" }),
              time: eta,
            })}
          </p>
          <p className="mt-1.5 text-sm text-muted">{t("dash.bookedBefore", { n: status.peopleAhead })}</p>
        </div>
      )}
    </section>
  );
}
