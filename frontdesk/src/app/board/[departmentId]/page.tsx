"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ArrowLeft } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { BoardDTO, QueueState } from "@/lib/contract-types";
import { useT } from "@/lib/i18n";
import { fmtClock, fmtDay, fmtTimeAt, tokenLabel } from "@/lib/format";

const REFRESH_MS = 10_000;

const PILL: Record<QueueState, string> = {
  OPEN: "border-status-done-border bg-status-done-bg text-status-done-text",
  PAUSED: "border-status-pending-border bg-status-pending-bg text-status-pending-text",
  CLOSED: "border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled-text",
};

// One split-flap card per character; a changed character gets a new key and flips in
function Flaps({ text }: { text: string }) {
  return (
    <span className="inline-flex" aria-label={text}>
      {[...text].map((ch, i) => (
        <span key={`${i}-${ch}`} aria-hidden className="flap">
          {ch}
        </span>
      ))}
    </span>
  );
}

// Public office TV: full screen over the site chrome, refreshed every 10 s, readable from across a hall
export default function BoardPage({ params }: { params: { departmentId: string } }) {
  const { t, lang } = useT();
  const board = useQuery({
    queryKey: ["board", params.departmentId],
    queryFn: () => apiClient<BoardDTO>(`/board/${params.departmentId}`),
    refetchInterval: REFRESH_MS,
  });

  // One clock tick drives the time, "updated Xs ago" and the recent-change highlight
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // When a service's now-serving number changes, light its tile for 10 s
  const previous = useRef(new Map<string, number>());
  const [changedAt, setChangedAt] = useState(new Map<string, number>());
  useEffect(() => {
    if (!board.data) return;
    const updates = new Map<string, number>();
    for (const s of board.data.services) {
      const before = previous.current.get(s.serviceId);
      if (before !== undefined && before !== s.nowServing) updates.set(s.serviceId, Date.now());
      previous.current.set(s.serviceId, s.nowServing);
    }
    if (updates.size) setChangedAt((prev) => new Map([...prev, ...updates]));
  }, [board.data]);

  const data = board.data;
  const notFound = board.error instanceof ApiError && board.error.code === "NOT_FOUND";
  const ticker = t("board.ticker");

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-board-bg text-board-digit">
      <div className="mx-auto flex min-h-full max-w-[1800px] flex-col px-6 py-6 lg:px-10 lg:py-8">
        <header className="flex flex-wrap items-end justify-between gap-6 border-b border-board-rule pb-6">
          <div className="min-w-0">
            <Link
              href="/board"
              className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-board-dim hover:text-board-digit"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("board.back")}
            </Link>
            <h1 className="mt-3 font-heading text-5xl font-bold leading-none lg:text-7xl">
              {data?.departmentName ?? (notFound ? t("board.notFound") : "…")}
            </h1>
            {data?.city && <p className="mt-2 text-xl font-semibold uppercase tracking-[0.2em] text-board-dim">{data.city}</p>}
          </div>
          {data && (
            <div className="text-right">
              <div className="font-heading text-5xl font-bold tabular-nums lg:text-6xl">
                {fmtTimeAt(new Date(now).toISOString(), data.timezone, lang)}
              </div>
              <p className="mt-1 text-xl text-board-dim">
                {fmtDay(data.date, lang, { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
          )}
        </header>

        <main className="flex-1 py-8">
          {board.isLoading && <p className="text-3xl text-board-dim">…</p>}
          {board.isError && !notFound && <p className="text-3xl text-board-dim">{t("common.loadError")}</p>}

          {/* Closed (week-off, holiday or after hours): say so, and when it opens next */}
          {data && !data.isOpenNow && (
            <div className="mb-8 flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-2xl border border-brand/40 bg-brand/10 px-6 py-5">
              <span className="font-heading text-4xl font-bold uppercase tracking-wide text-brand lg:text-5xl">
                {t("board.closedNow")}
              </span>
              {data.opensNext && (
                <span className="text-2xl font-semibold text-board-digit lg:text-3xl">
                  {t("board.opensAt", {
                    day: fmtDay(data.opensNext.date, lang, { weekday: "long", day: "numeric", month: "long" }),
                    time: fmtClock(data.opensNext.time, lang),
                  })}
                </span>
              )}
            </div>
          )}

          {data && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {data.services.map((s) => {
                const recent = now - (changedAt.get(s.serviceId) ?? 0) < REFRESH_MS;
                return (
                  <section
                    key={s.serviceId}
                    className="relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-board-rule bg-board-tile p-6"
                  >
                    <span
                      aria-hidden
                      className={clsx("absolute inset-x-0 top-0 h-1 transition-colors duration-700", recent ? "bg-brand" : "bg-transparent")}
                    />
                    <div className="min-w-0">
                      <h2 className="truncate font-heading text-3xl font-bold uppercase tracking-wide text-board-digit/80">{s.name}</h2>
                      <p className="text-lg font-bold tracking-[0.2em] text-board-dim">{s.code}</p>
                    </div>

                    <div>
                      <div className="text-base font-bold uppercase tracking-[0.25em] text-board-dim">{t("board.nowServing")}</div>
                      <div className="mt-3 font-heading font-bold leading-none tabular-nums" style={{ fontSize: "clamp(56px, 6vw, 128px)" }}>
                        <Flaps text={s.nowServing > 0 ? tokenLabel(s.code, s.nowServing) : "— —"} />
                      </div>
                    </div>

                    {s.upNext.length > 0 && (
                      <div>
                        <div className="text-base font-bold uppercase tracking-[0.25em] text-board-dim">{t("board.upNext")}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {s.upNext.map((n) => (
                            <span
                              key={n}
                              className="rounded-lg border border-board-rule bg-board-bg px-3 py-1 font-heading text-[28px] font-bold leading-tight tabular-nums"
                            >
                              {tokenLabel(s.code, n)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto space-y-3 border-t border-board-rule pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[28px] font-semibold leading-tight">
                          {s.queueStatus
                            ? t("board.waiting", { n: s.waiting })
                            : t(data.isOpenNow ? "board.noTokens" : "board.closedNow")}
                        </span>
                        {s.queueStatus && (
                          <span className={clsx("rounded-full border px-3 py-1 text-base font-bold uppercase tracking-wider", PILL[s.queueStatus])}>
                            {t(`queue.${s.queueStatus}` as const)}
                          </span>
                        )}
                      </div>
                      {data.isOpenNow && (
                        <p className={clsx("text-xl font-semibold", s.availableToday > 0 ? "text-status-done-border" : "text-brand")}>
                          {s.availableToday > 0 ? t("board.availableToday", { n: s.availableToday }) : t("board.fullToday")}
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>

        <footer className="flex items-center gap-6 border-t border-board-rule pt-4">
          <div className="min-w-0 flex-1 overflow-hidden">
            {/* Four equal copies with trailing padding, so shifting by -50% loops seamlessly */}
            <div className="marquee flex w-max whitespace-nowrap text-2xl font-semibold text-board-digit/80">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} aria-hidden={i > 0} className="pr-24">
                  {ticker}
                </span>
              ))}
            </div>
          </div>
          {data && (
            <span className="shrink-0 text-lg text-board-dim">
              {t("board.updated", { s: Math.max(0, Math.round((now - board.dataUpdatedAt) / 1000)) })}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
