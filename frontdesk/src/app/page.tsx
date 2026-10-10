"use client";

import Link from "next/link";
import { ArrowRight, BellRing, BookmarkCheck, Clock3, MapPin, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useBookToken } from "@/components/booking/BookTokenModal";
import { useT, type TKey } from "@/lib/i18n";
import { fmtClock, fmtDay, fmtWeekday } from "@/lib/format";

const steps: { number: string; title: TKey; description: TKey }[] = [
  { number: "01", title: "home.step1Title", description: "home.step1" },
  { number: "02", title: "home.step2Title", description: "home.step2" },
  { number: "03", title: "home.step3Title", description: "home.step3" },
];

const queueDots = Array.from({ length: 9 }, (_, index) => index + 1);
const WEEK_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0];
// Sample values for the illustrations on this page
const SAMPLE_DATE = "2026-10-12";

export default function LandingPage() {
  const { t, lang } = useT();
  // Signed in: opens the Book token modal. Signed out: goes to /login first.
  const { open: openBooking } = useBookToken();

  return (
    <div className="space-y-10 py-6 md:py-10">
      <section className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-cream px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand shadow-sm">
            <BookmarkCheck className="h-3.5 w-3.5" />
            {t("home.kicker")}
          </div>

          <div className="space-y-4">
            <h1 className="max-w-xl text-5xl font-bold leading-[0.92] tracking-[-0.04em] text-ink sm:text-6xl lg:text-[5rem]">
              {t("home.title1")} <span className="block text-brand">{t("home.title2")}</span>
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">{t("home.subtitle")}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <Button size="lg" className="gap-2 px-7 text-base shadow-card" onClick={openBooking}>
              <span>{t("home.book")}</span>
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="px-7 text-base">
                {t("home.create")}
              </Button>
            </Link>
          </div>

          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("home.statQueue")}</div>
              <div className="mt-2 font-heading text-3xl text-ink">12</div>
            </div>
            <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("home.statWait")}</div>
              <div className="mt-2 font-heading text-3xl text-ink">{t("home.minutes", { n: 14 })}</div>
            </div>
            <div className="rounded-2xl border border-border bg-card/90 p-4 shadow-card">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{t("home.statNow")}</div>
              <div className="mt-2 font-heading text-3xl text-ink">007</div>
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[420px]">
          <div className="token-slip specimen rotate-[-2deg]">
            <div className="slip-top flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
              <span>{t("home.sampleOffice")}</span>
              <span>{t("home.sampleService")}</span>
            </div>

            <div className="mt-6 flex items-start justify-between gap-3">
              <div>
                <div className="micro-label">{t("slip.token")}</div>
                <div className="mt-2 text-5xl font-heading tracking-[-0.04em] text-ink sm:text-6xl">DL-012</div>
              </div>
              <div className="status-stamp">{t("status.WAITING")}</div>
            </div>

            <div className="mt-6 space-y-3 border-t border-dashed border-border/80 pt-3 text-sm text-ink">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{t("slip.expected")}</span>
                <span className="font-semibold">~{fmtClock("10:40", lang)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted">{t("slip.bookedFor")}</span>
                <span className="font-semibold">{fmtDay(SAMPLE_DATE, lang)}</span>
              </div>
            </div>

            <div className="slip-stub mt-6 flex items-center justify-between gap-3 border-t border-dashed border-border/80 pt-4">
              <div className="space-y-1">
                <div className="micro-label">{t("slip.showAtCounter")}</div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">DL-012</div>
              </div>
              <div className="qr-box flex h-16 w-16 items-center justify-center rounded-md border border-border bg-white text-[9px] font-bold uppercase tracking-[0.18em] text-brand">
                QR
              </div>
            </div>
          </div>

          <div className="queue-preview absolute -bottom-6 left-[-0.75rem] w-[72%] rotate-[-3deg]">
            <div className="queue-preview-header flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-cream/80">
              <span>{t("rail.nowServing")}</span>
              <span>007</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {queueDots.map((value) => (
                <span key={value} className={value <= 5 ? "queue-dot" : "queue-dot muted"} />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
              <span>{t("rail.you")}</span>
              <span>{t("rail.ahead", { n: 2 })}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-border bg-[#1a1715] p-4 text-cream shadow-card md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-cream/70">
          <span>{t("home.liveBoard")}</span>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-cream/20 bg-cream/5 px-2.5 py-1 text-[9px] text-brand">
              <span className="inline-block h-2 w-2 animate-ping rounded-full bg-brand" />
              {t("live.live")} · {t("live.updated", { s: 8 })}
            </span>
            <Link
              href="/board"
              className="inline-flex items-center gap-1.5 rounded-full border border-cream/30 px-3 py-1 text-[10px] text-cream hover:bg-cream/10"
            >
              {t("home.seeBoards")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: t("stat.nowServing"), value: "007", tone: "text-brand" },
            { label: t("stat.ahead"), value: "08", tone: "text-cream" },
            { label: t("stat.position"), value: "03", tone: "text-cream" },
            { label: t("home.statWait"), value: t("home.minutes", { n: 14 }), tone: "text-brand" },
          ].map((item) => (
            <div key={item.label} className="board-tile text-center">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cream/60">{item.label}</div>
              <div className={`mt-2 font-heading text-4xl tracking-[-0.05em] ${item.tone}`}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="text-center">
          <div className="micro-label text-brand">{t("home.how")}</div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.number} className="p-5 sm:p-6">
              <div className="mb-4 font-heading text-[2.5rem] leading-none text-brand/80">{step.number}</div>
              <h3 className="mb-2 font-heading text-2xl uppercase tracking-[0.04em] text-ink">{t(step.title)}</h3>
              <p className="text-sm leading-relaxed text-muted">{t(step.description)}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <Card className="p-5 space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Smartphone className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-2xl uppercase tracking-[0.04em] text-ink">{t("home.f1Title")}</h3>
          <p className="text-sm leading-relaxed text-muted">{t("home.f1")}</p>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <Clock3 className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-2xl uppercase tracking-[0.04em] text-ink">{t("home.f2Title")}</h3>
          <p className="text-sm leading-relaxed text-muted">{t("home.f2")}</p>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <BellRing className="h-6 w-6" />
          </div>
          <h3 className="font-heading text-2xl uppercase tracking-[0.04em] text-ink">{t("home.f3Title")}</h3>
          <p className="text-sm leading-relaxed text-muted">{t("home.f3")}</p>
        </Card>
      </section>

      <section className="rounded-[2rem] border border-border bg-card p-5 shadow-card md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="micro-label text-brand">{t("home.noticeLabel")}</div>
            <h3 className="mt-2 font-heading text-3xl uppercase tracking-[0.04em] text-ink">{t("home.noticeTitle")}</h3>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">
            <MapPin className="h-3.5 w-3.5" />
            12, Civic Lane, Jaipur
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-3 rounded-2xl border border-border bg-cream px-4 py-3">
            <div className="flex items-center justify-between text-sm font-medium text-ink">
              <span>{t("board.openToday")}</span>
              <span className="text-emerald-700">
                {fmtClock("09:00", lang)} – {fmtClock("17:00", lang)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
              {WEEK_FROM_MONDAY.map((day, index) => (
                <span
                  key={day}
                  className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                    index === 3 ? "border-brand bg-brand text-white" : "border-border bg-card text-ink"
                  }`}
                >
                  {fmtWeekday(day, lang, "narrow")}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="micro-label text-muted">{t("home.beforeYouGo")}</div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t("home.beforeYouGoText")}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
