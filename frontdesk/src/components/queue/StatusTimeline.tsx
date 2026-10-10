"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";
import type { TokenState } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";

const STEPS: TokenState[] = ["WAITING", "ARRIVED", "IN_SERVICE", "COMPLETED"];

// Waiting -> Arrived -> In service -> Completed. Cancelled and no-show tokens show the slip stamp instead.
export function StatusTimeline({ status }: { status: TokenState }) {
  const { t } = useT();
  const current = STEPS.indexOf(status);
  if (current === -1) return null;

  return (
    <ol className="flex items-start">
      {STEPS.map((step, i) => {
        const done = i < current || status === "COMPLETED";
        const active = i === current && status !== "COMPLETED";
        return (
          <li key={step} className="relative flex flex-1 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
            {i > 0 && (
              <span
                aria-hidden
                className={clsx("absolute right-1/2 top-3 h-px w-full", i <= current ? "bg-ink" : "bg-border")}
              />
            )}
            <span
              className={clsx(
                "relative z-10 grid h-6 w-6 place-items-center rounded-full border-2 bg-card",
                done && "border-ink bg-ink text-cream",
                active && "border-brand ring-4 ring-brand/15",
                !done && !active && "border-border"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : active ? <span className="h-2 w-2 rounded-full bg-brand" /> : null}
            </span>
            <span
              className={clsx(
                "mt-2 px-1 text-[11px] uppercase tracking-[0.12em]",
                active ? "font-bold text-ink" : "font-semibold text-muted"
              )}
            >
              {t(`status.${step}` as const)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
