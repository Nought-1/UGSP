"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface LiveBadgeProps {
  updatedAt: number | null; // Date.now() of the last successful refresh; null before the first one
  paused?: boolean; // polling stopped (e.g. the last refresh failed)
  className?: string;
}

export function LiveBadge({ updatedAt, paused = false, className }: LiveBadgeProps) {
  // The clock only runs in the browser: reading Date.now() during render breaks prerendering (cacheComponents)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = updatedAt !== null && now !== null ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;

  return (
    <span className={cn("micro-label inline-flex items-center gap-2", className)}>
      <span className="relative flex size-2" aria-hidden>
        {!paused && <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-75" />}
        <span className={cn("relative inline-flex size-2 rounded-full", paused ? "bg-muted-foreground" : "bg-brand")} />
      </span>
      {paused ? "Paused" : seconds === null ? "Live" : `Live · updated ${seconds}s ago`}
    </span>
  );
}
