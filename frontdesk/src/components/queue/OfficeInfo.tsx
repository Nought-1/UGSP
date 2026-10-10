"use client";

import { clsx } from "clsx";
import { Clock3, MapPin } from "lucide-react";
import type { OfficeDTO } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";
import { fmtClock, fmtWeekday } from "@/lib/format";

const WEEK_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0];

// A printed notice: office, address, today's hours (or "Closed today"), and the week with off-days struck out
export function OfficeInfo({ office, className }: { office: OfficeDTO; className?: string }) {
  const { t, lang } = useT();
  const address = [office.address, office.city].filter(Boolean).join(", ");

  return (
    <section className={clsx("rounded-2xl border border-border bg-card p-5 shadow-card", className)}>
      <div className="micro-label">{t("book.office")}</div>
      <h3 className="mt-1 font-heading text-xl font-bold text-ink">{office.name}</h3>
      {address && (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{address}</span>
        </p>
      )}

      <div className="mt-4 border-t border-dashed border-border-dark pt-3">
        <div className="micro-label">{t("office.today")}</div>
        {office.isOpenToday ? (
          <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Clock3 className="h-4 w-4 text-muted" />
            {t("office.open", {
              from: fmtClock(office.workingHours.start, lang),
              to: fmtClock(office.workingHours.end, lang),
            })}
          </p>
        ) : (
          <p className="mt-1 text-sm font-bold text-brand">{t("office.closedToday")}</p>
        )}
      </div>

      <ul className="mt-4 flex gap-1.5" aria-label={t("office.weekOffs")}>
        {WEEK_FROM_MONDAY.map((day) => {
          const off = office.weekOffDays.includes(day);
          return (
            <li
              key={day}
              title={fmtWeekday(day, lang, "long")}
              className={clsx(
                "grid h-8 min-w-8 flex-1 place-items-center rounded-md border text-[11px] font-bold",
                off ? "border-border text-muted/60 line-through" : "border-ink/20 text-ink"
              )}
            >
              {fmtWeekday(day, lang, "narrow")}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
