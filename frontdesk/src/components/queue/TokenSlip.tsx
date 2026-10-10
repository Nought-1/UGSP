"use client";

import { clsx } from "clsx";
import { QRCodeSVG } from "qrcode.react";
import type { TokenDTO, TokenState } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";
import { fmtDay, fmtTimeAt } from "@/lib/format";

// Stamp colour per status (globals.css): ink waiting, blue arrived, red in service, green done, struck-through void
const STAMP: Record<TokenState, string> = {
  WAITING: "stamp-ink",
  ARRIVED: "stamp-called",
  IN_SERVICE: "",
  COMPLETED: "stamp-done",
  CANCELLED: "stamp-void",
  NO_SHOW: "stamp-void",
};

export function StatusStamp({ status, className }: { status: TokenState; className?: string }) {
  const { t } = useT();
  return <span className={clsx("status-stamp shrink-0", STAMP[status], className)}>{t(`status.${status}` as const)}</span>;
}

interface TokenSlipProps {
  token: TokenDTO;
  variant?: "full" | "compact"; // full: tear-off stub with QR (status page); compact: booking success
  etaIso?: string; // live ETA; defaults to the stored estimate
  className?: string;
}

// The token as a printed queue slip: office and date, the big label, a status stamp, and a QR stub
export function TokenSlip({ token, variant = "full", etaIso, className }: TokenSlipProps) {
  const { t, lang } = useT();
  const isVoid = token.status === "CANCELLED" || token.status === "NO_SHOW";

  return (
    <article className={clsx("token-slip", className)} aria-label={`${t("slip.token")} ${token.label}`}>
      <div className={clsx("slip-top", isVoid && "opacity-60")}>
        <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
          <span className="truncate">{token.departmentName}</span>
          <span className="shrink-0">{fmtDay(token.date, lang)}</span>
        </div>

        <div className="mt-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="micro-label">{t("slip.token")}</div>
            <div className="mt-1 font-heading text-6xl font-bold leading-none tracking-[-0.03em] tabular-nums text-ink sm:text-7xl">
              {token.label}
            </div>
            <div className="mt-2 truncate text-sm font-semibold text-ink">{token.serviceName}</div>
          </div>
          {!isVoid && <StatusStamp status={token.status} className="mt-3" />}
        </div>

        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">{t("slip.expected")}</dt>
            <dd className="font-semibold tabular-nums text-ink">
              ~{fmtTimeAt(etaIso ?? token.estimatedServeAt, token.timezone, lang)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">{t("slip.bookedFor")}</dt>
            <dd className="font-semibold text-ink">
              {fmtDay(token.date, lang, { weekday: "long", day: "numeric", month: "long" })}
            </dd>
          </div>
        </dl>
      </div>

      {variant === "full" && (
        <div className={clsx("slip-stub flex items-center justify-between gap-4", isVoid && "opacity-60")}>
          <div className="min-w-0 space-y-1">
            <div className="micro-label">{t("slip.showAtCounter")}</div>
            <div className="font-heading text-lg tracking-wide text-ink">{token.label}</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
              #{token.id.slice(-8).toUpperCase()}
            </div>
          </div>
          <div className="shrink-0 rounded-md border border-border bg-white p-1.5">
            <QRCodeSVG value={token.id} size={84} fgColor="#1E1917" bgColor="#FFFFFF" />
          </div>
        </div>
      )}

      {/* Cancelled / no-show: a big rubber stamp across the slip */}
      {isVoid && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <span className="status-stamp" style={{ fontSize: "1.35rem", padding: "0.6rem 1.1rem", transform: "rotate(-14deg)" }}>
            {t(`status.${token.status}` as const)}
          </span>
        </div>
      )}
    </article>
  );
}
