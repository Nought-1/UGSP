"use client";

import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

// "LIVE · updated 8s ago" with a pulsing dot; "Updates paused" once polling stops
export function LiveBadge({ updatedAt, paused = false }: { updatedAt: number; paused?: boolean }) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [paused]);

  if (paused) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
        <span className="h-2 w-2 rounded-full bg-muted/50" />
        {t("live.paused")}
      </span>
    );
  }

  const seconds = Math.max(0, Math.round((now - updatedAt) / 1000));
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
      </span>
      {t("live.live")} · {t("live.updated", { s: seconds })}
    </span>
  );
}
