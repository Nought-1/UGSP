"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { apiClient } from "@/lib/api-client";
import type { OfficeDTO } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";

// Public: pick an office to open its now-serving board
export default function BoardPickerPage() {
  const { t } = useT();
  const offices = useQuery({ queryKey: ["departments"], queryFn: () => apiClient<OfficeDTO[]>("/departments") });

  return (
    <div className="space-y-6 py-2">
      <header className="reveal">
        <h1 className="font-heading text-4xl font-bold text-ink sm:text-5xl">{t("board.title")}</h1>
        <p className="mt-1 text-muted">{t("board.subtitle")}</p>
      </header>

      {offices.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {offices.isError && (
        <EmptyState
          title={t("common.loadError")}
          action={<Button variant="outline" onClick={() => offices.refetch()}>{t("common.retry")}</Button>}
        />
      )}

      {offices.data && offices.data.length === 0 && <EmptyState title={t("board.noOffices")} />}

      {offices.data && offices.data.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offices.data.map((office, i) => (
            <li key={office.id} className="reveal" style={{ animationDelay: `${60 + i * 40}ms` }}>
              <Link
                href={`/board/${office.id}`}
                className="group block overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-0.5 hover:border-ink/40"
              >
                <div className="flex items-start justify-between gap-3 p-5">
                  <div className="min-w-0">
                    <h2 className="truncate font-heading text-2xl font-bold text-ink">{office.name}</h2>
                    {office.city && <p className="micro-label mt-1">{office.city}</p>}
                  </div>
                  <span
                    className={clsx(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                      office.isOpenToday
                        ? "border-status-done-border bg-status-done-bg text-status-done-text"
                        : "border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled-text"
                    )}
                  >
                    {t(office.isOpenToday ? "board.openToday" : "board.closedToday")}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-board-bg px-5 py-3">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-board-dim">{t("board.nowServing")}</span>
                  <ArrowRight className="h-4 w-4 text-board-digit transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
