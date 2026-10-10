// "YYYY-MM-DD" helpers for leave. Strings are split by hand, never parsed with new Date("YYYY-MM-DD") (that is UTC
// midnight and shifts the day in other zones). Calendar Dates are local midnight, which is what the admin clicked.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const pad = (n: number) => String(n).padStart(2, "0");
const parts = (ymd: string) => ymd.split("-").map(Number) as [number, number, number];

export const toYmd = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export function fromYmd(ymd: string) {
  const [y, m, d] = parts(ymd);
  return new Date(y, m - 1, d);
}

// Days in an inclusive range
export function dayCount(from: string, to: string) {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000) + 1;
}

// "12 Oct", "12–14 Oct", "30 Oct – 2 Nov"
export function rangeLabel(from: string, to: string) {
  const [, m1, d1] = parts(from);
  const [, m2, d2] = parts(to);
  if (from === to) return `${d1} ${MONTHS[m1 - 1]}`;
  if (m1 === m2) return `${d1}–${d2} ${MONTHS[m1 - 1]}`;
  return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]}`;
}

// "October 2026"
export function monthLabel(ymd: string) {
  const [y, m] = parts(ymd);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

export const monthShort = (ymd: string) => MONTHS[parts(ymd)[1] - 1];
export const dayOfMonth = (ymd: string) => parts(ymd)[2];

// Calendar matcher: days before today (runs when the calendar renders in the browser, never during prerender)
export function isPastDay(day: Date) {
  const now = new Date();
  return day < new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
