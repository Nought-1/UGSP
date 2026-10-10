"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AvailabilityDTO } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";
import { daysInMonth, fmtDay, fmtMonth, fmtWeekday, toYmd, weekdayOfFirst, ymdParts } from "@/lib/format";

const WEEK_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0];
const LOW_SLOTS = 3;

interface SlotCalendarProps {
  availability: AvailabilityDTO;
  value: string | null;
  onChange: (date: string) => void;
}

// Month grid over the booking window. Only bookable days are enabled; each shows the slots left.
// (A native date input can't disable arbitrary days or show slot counts.)
export function SlotCalendar({ availability, value, onChange }: SlotCalendarProps) {
  const { t, lang } = useT();
  const slots = useMemo(() => new Map(availability.dates.map((d) => [d.date, d.slotsLeft])), [availability]);

  const start = ymdParts(availability.windowStart);
  const end = ymdParts(availability.windowEnd);
  const firstBookable = ymdParts(availability.dates[0]?.date ?? availability.windowStart);
  const [cursor, setCursor] = useState({ year: firstBookable.year, month0: firstBookable.month0 });

  const monthIndex = (y: number, m: number) => y * 12 + m;
  const canPrev = monthIndex(cursor.year, cursor.month0) > monthIndex(start.year, start.month0);
  const canNext = monthIndex(cursor.year, cursor.month0) < monthIndex(end.year, end.month0);
  const step = (delta: number) => {
    const m = monthIndex(cursor.year, cursor.month0) + delta;
    setCursor({ year: Math.floor(m / 12), month0: m % 12 });
  };

  const lead = (weekdayOfFirst(cursor.year, cursor.month0) + 6) % 7; // Monday-first grid
  const days = Array.from({ length: daysInMonth(cursor.year, cursor.month0) }, (_, i) => toYmd(cursor.year, cursor.month0, i + 1));
  const longDay = (ymd: string) => fmtDay(ymd, lang, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!canPrev}
          aria-label={t("book.prevMonth")}
          className="grid h-11 w-11 place-items-center rounded-lg text-ink hover:bg-cream disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="font-heading text-lg font-bold text-ink">{fmtMonth(cursor.year, cursor.month0, lang)}</div>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={!canNext}
          aria-label={t("book.nextMonth")}
          className="grid h-11 w-11 place-items-center rounded-lg text-ink hover:bg-cream disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div role="grid" className="mt-2 grid grid-cols-7 gap-1 text-center">
        {WEEK_FROM_MONDAY.map((d) => (
          <div key={d} role="columnheader" className="micro-label py-1">
            {fmtWeekday(d, lang, "narrow")}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {days.map((ymd) => {
          const left = slots.get(ymd);
          const bookable = left !== undefined;
          const selected = ymd === value;
          return (
            <button
              key={ymd}
              type="button"
              role="gridcell"
              disabled={!bookable}
              aria-selected={selected}
              aria-label={bookable ? t("book.dayAria", { date: longDay(ymd), n: left }) : longDay(ymd)}
              onClick={() => onChange(ymd)}
              className={clsx(
                "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg border text-sm transition-colors",
                !bookable && "cursor-not-allowed border-transparent text-muted/35",
                bookable && !selected && "border-border bg-card text-ink hover:border-ink",
                selected && "border-ink bg-ink text-cream",
                ymd === availability.windowStart && !selected && "ring-2 ring-brand/60"
              )}
            >
              <span className="font-semibold tabular-nums">{Number(ymd.slice(8))}</span>
              {bookable && (
                <span
                  className={clsx(
                    "font-heading text-[10px] leading-none tracking-wide",
                    selected ? "text-cream/80" : left <= LOW_SLOTS ? "text-status-pending-text" : "text-muted"
                  )}
                >
                  {t("book.slotsLeft", { n: left })}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <p className="micro-label mt-3">{t("book.legend")}</p>
    </div>
  );
}
