"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { clsx } from "clsx";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { TokenSlip } from "@/components/queue/TokenSlip";
import { useAvailability, useBookTokenMutation } from "@/hooks/useBooking";
import { ApiError } from "@/lib/api-client";
import type { ServiceDTO, TokenDTO } from "@/lib/contract-types";
import { useT, type TKey } from "@/lib/i18n";
import { fmtDay, fmtTimeAt } from "@/lib/format";
import { ServicePicker } from "./ServicePicker";
import { SlotCalendar } from "./SlotCalendar";

// ---- "Book token" can be opened from anywhere (navbar, dashboard, empty states) ----

const BookTokenContext = createContext<{ open: () => void } | null>(null);

export function BookTokenProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const open = useCallback(() => {
    if (status !== "authenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(pathname || "/")}`);
      return;
    }
    setIsOpen(true);
  }, [status, router, pathname]);

  return (
    <BookTokenContext.Provider value={{ open }}>
      {children}
      {isOpen && <BookTokenModal onClose={() => setIsOpen(false)} />}
    </BookTokenContext.Provider>
  );
}

export function useBookToken() {
  const ctx = useContext(BookTokenContext);
  if (!ctx) throw new Error("useBookToken must be used inside BookTokenProvider");
  return ctx;
}

// ---- The modal: Service -> Date -> Confirm -> Success ----

type Step = "service" | "date" | "confirm" | "done";
const STEPS: { id: Exclude<Step, "done">; label: TKey }[] = [
  { id: "service", label: "book.step.service" },
  { id: "date", label: "book.step.date" },
  { id: "confirm", label: "book.step.confirm" },
];
const TITLES: Record<Step, TKey> = {
  service: "book.title.service",
  date: "book.title.date",
  confirm: "book.title.confirm",
  done: "book.title.done",
};

function StepStrip({ step }: { step: Step }) {
  const { t } = useT();
  const current = STEPS.findIndex((s) => s.id === step);
  return (
    <ol className="mb-5 flex items-center gap-2 border-b border-dashed border-border-dark pb-4">
      {STEPS.map((s, i) => (
        <li key={s.id} className="flex flex-1 items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span
            className={clsx(
              "grid h-6 w-6 shrink-0 place-items-center rounded-full font-heading text-xs font-bold",
              i < current && "bg-ink text-cream",
              i === current && "bg-brand text-white",
              i > current && "border border-border text-muted"
            )}
          >
            {i + 1}
          </span>
          <span className={clsx("truncate text-xs font-bold uppercase tracking-[0.14em]", i === current ? "text-ink" : "text-muted")}>
            {t(s.label)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <span aria-hidden className="mb-1 flex-1 border-b border-dotted border-border-dark" />
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

function BookTokenModal({ onClose }: { onClose: () => void }) {
  const { t, te, lang } = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<ServiceDTO | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [booked, setBooked] = useState<TokenDTO | null>(null);
  const [error, setError] = useState<{ message: string; tokenId?: string } | null>(null);

  const availability = useAvailability(service?.id);
  const book = useBookTokenMutation();
  const day = availability.data?.dates.find((d) => d.date === date);
  const longDay = (ymd: string) => fmtDay(ymd, lang, { weekday: "long", day: "numeric", month: "long" });

  const confirm = () => {
    if (!service || !date) return;
    setError(null);
    book.mutate(
      { serviceId: service.id, date },
      {
        onSuccess: (token) => {
          setBooked(token);
          setStep("done");
        },
        onError: (err) => {
          const code = err instanceof ApiError ? err.code : "";
          if (code === "DATE_FULL" || code === "DATE_NOT_BOOKABLE") {
            // The day changed under us: back to the calendar with fresh counts
            setError({ message: t(code === "DATE_FULL" ? "book.errFull" : "book.errNotBookable") });
            setDate(null);
            setStep("date");
            availability.refetch();
          } else if (code === "ALREADY_BOOKED" && err instanceof ApiError) {
            setError({ message: t("book.errAlready"), tokenId: err.details.tokenId as string | undefined });
          } else {
            setError({ message: te(err) });
          }
        },
      }
    );
  };

  return (
    <Modal isOpen onClose={onClose} title={t(TITLES[step])} maxWidth="lg">
      {step !== "done" && <StepStrip step={step} />}

      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-status-pending-border bg-status-pending-bg p-3 text-sm text-status-pending-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">{error.message}</p>
            {error.tokenId && (
              <Link href={`/citizen/tokens/${error.tokenId}`} onClick={onClose} className="mt-1 inline-block font-bold underline">
                {t("book.openThatToken")}
              </Link>
            )}
          </div>
        </div>
      )}

      {step === "service" && (
        <ServicePicker
          onPick={(picked) => {
            setService(picked);
            setDate(null);
            setError(null);
            setStep("date");
          }}
        />
      )}

      {step === "date" && service && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-cream/50 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{service.name}</p>
              <p className="truncate text-xs text-muted">
                {service.departmentName}
                {service.city ? ` · ${service.city}` : ""}
              </p>
            </div>
            <button type="button" onClick={() => setStep("service")} className="shrink-0 text-sm font-bold text-brand hover:underline">
              {t("common.change")}
            </button>
          </div>

          {availability.isLoading && <Skeleton className="h-80" />}
          {availability.isError && (
            <div className="space-y-3 rounded-xl border border-border p-6 text-center">
              <p className="text-sm text-muted">{t("common.loadError")}</p>
              <Button variant="outline" size="sm" onClick={() => availability.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          )}
          {availability.data &&
            (availability.data.dates.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border-dark p-6 text-center text-sm text-muted">
                {t("book.noDays", { n: service.bookingWindowDays })}
              </p>
            ) : (
              <SlotCalendar availability={availability.data} value={date} onChange={setDate} />
            ))}

          <p className="min-h-[1.25rem] text-sm font-semibold text-ink" aria-live="polite">
            {day && availability.data
              ? t("book.expectedAround", {
                  time: fmtTimeAt(day.expectedServeAt, availability.data.timezone, lang),
                  n: day.slotsLeft,
                })
              : t("book.pickDay")}
          </p>

          <div className="flex gap-3 border-t border-border pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setStep("service")}>
              {t("common.back")}
            </Button>
            <Button className="flex-1" disabled={!day} onClick={() => setStep("confirm")}>
              {t("common.continue")}
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && service && day && availability.data && (
        <div className="space-y-5">
          <dl className="space-y-3 rounded-xl border border-border bg-cream/40 p-4">
            <ReceiptRow label={t("book.service")} value={service.name} />
            <ReceiptRow label={t("book.office")} value={service.departmentName} />
            <ReceiptRow label={t("book.date")} value={longDay(day.date)} />
            <ReceiptRow
              label={t("book.expectedTime")}
              value={`~${fmtTimeAt(day.expectedServeAt, availability.data.timezone, lang)}`}
            />
          </dl>
          <div className="flex gap-3 border-t border-border pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setStep("date")} disabled={book.isPending}>
              {t("common.back")}
            </Button>
            <Button className="flex-1" onClick={confirm} isLoading={book.isPending}>
              {t("book.confirm")}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && booked && (
        <div className="space-y-5">
          <p className="micro-label text-center !text-brand">{t("book.inQueue")}</p>
          <TokenSlip token={booked} variant="compact" className="slip-print" />
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t("common.close")}
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                onClose();
                router.push(`/citizen/tokens/${booked.id}`);
              }}
            >
              {t("book.viewStatus")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
