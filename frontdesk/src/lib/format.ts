// Display helpers shared by the API and the UI (no Mongoose imports, safe in the browser).
// Dates are "YYYY-MM-DD" and times "HH:mm" in the office's time zone; they are wall-clock values,
// so they are formatted in UTC to stop the browser's zone from shifting them.
import type { Language } from "./i18n";

// Printed token label, e.g. ("DL", 12) -> "DL-012"
export const tokenLabel = (code: string, n: number) => `${code}-${String(n).padStart(3, "0")}`;

const LOCALES: Record<Language, string> = { en: "en-IN", hi: "hi-IN", gu: "gu-IN" };
// Latin digits everywhere, so numbers match the printed slip and the board
const fmt = (lang: Language, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(LOCALES[lang], { numberingSystem: "latn", ...opts });

function wallClock(ymd: string, hm = "00:00") {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, min] = hm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min));
}

// "Mon, 12 Oct" style, in the active language
export function fmtDay(ymd: string, lang: Language, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return fmt(lang, { ...opts, timeZone: "UTC" }).format(wallClock(ymd));
}

// "HH:mm" office time -> "4:30 pm"
export function fmtClock(hm: string, lang: Language) {
  return fmt(lang, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(wallClock("2000-01-01", hm));
}

// An exact moment (ISO) shown in the office's time zone
export function fmtTimeAt(iso: string, timeZone: string, lang: Language) {
  return fmt(lang, { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

// 0 = Sunday ... 6 = Saturday (1 Jan 2023 was a Sunday)
export function fmtWeekday(day: number, lang: Language, style: "narrow" | "short" | "long" = "short") {
  return fmt(lang, { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2023, 0, 1 + day)));
}

export function fmtMonth(year: number, month0: number, lang: Language) {
  return fmt(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month0, 1)));
}

// Today's date in the user's own clock, e.g. "Saturday, 10 October"
export function fmtToday(lang: Language) {
  return fmt(lang, { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

// "YYYY-MM-DD" for now in an office's time zone (browser-side twin of queue-core's todayIn)
export function todayInZone(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// --- Calendar arithmetic on "YYYY-MM-DD" (UTC, so no zone can shift the day)

export function ymdParts(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return { year: y, month0: m - 1, day: d };
}

export const toYmd = (year: number, month0: number, day: number) =>
  new Date(Date.UTC(year, month0, day)).toISOString().slice(0, 10);

export const daysInMonth = (year: number, month0: number) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

export const weekdayOfFirst = (year: number, month0: number) => new Date(Date.UTC(year, month0, 1)).getUTCDay();
