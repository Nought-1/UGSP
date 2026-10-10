"use client";

import { clsx } from "clsx";
import { useT } from "@/lib/i18n";
import { tokenLabel } from "@/lib/format";

const MAX_DOTS = 18;

interface QueueRailProps {
  nowServing: number;
  peopleAhead: number;
  serviceCode: string;
  className?: string;
}

// The counter (now serving) on the left, one dot per person ahead, and "you" at the end
export function QueueRail({ nowServing, peopleAhead, serviceCode, className }: QueueRailProps) {
  const { t } = useT();
  const nowLabel = nowServing > 0 ? tokenLabel(serviceCode, nowServing) : "—";
  const shown = Math.min(peopleAhead, MAX_DOTS);

  return (
    <div
      className={clsx("queue-preview text-cream", className)}
      role="img"
      aria-label={t("rail.aria", { n: peopleAhead, now: nowLabel })}
    >
      <div className="queue-preview-header flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-cream/70">
        <span>{t("rail.nowServing")}</span>
        <span className="font-heading text-base tracking-wide tabular-nums text-cream">{nowLabel}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {Array.from({ length: shown }, (_, i) => (
          <span key={i} className="queue-dot transition-opacity duration-500" />
        ))}
        {peopleAhead > MAX_DOTS && (
          <span className="rounded-full border border-cream/20 px-2 py-0.5 text-[10px] font-bold tabular-nums text-cream/80">
            +{peopleAhead - MAX_DOTS}
          </span>
        )}
        <span className="queue-you">{t("rail.you")}</span>
      </div>

      <div className="mt-3 text-right text-[10px] font-bold uppercase tracking-[0.18em] text-cream/80">
        {peopleAhead === 0 ? t("rail.next") : t("rail.ahead", { n: peopleAhead })}
      </div>
    </div>
  );
}
