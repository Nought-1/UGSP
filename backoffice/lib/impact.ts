// Impact numbers for the dashboard (_notes/backoffice-plan.md §7), from tokens that reached a counter.
export interface ServedToken {
  openAt: Date; // the department's opening time on the token's day
  createdAt: Date; // booked
  arrivedAt?: Date | null; // walked in
  startedAt: Date; // called to a counter
  bookedServeAt: Date; // the ETA promised at booking
}

const minutesBetween = (later: Date, earlier: Date) => (later.getTime() - earlier.getTime()) / 60_000;
const mean = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null);
const round = (value: number | null) => (value === null ? null : Math.round(value));

export function impactOf(tokens: ServedToken[]) {
  const arrived = tokens.filter((t): t is ServedToken & { arrivedAt: Date } => Boolean(t.arrivedAt));
  // Time a citizen did not spend in the office: from the later of opening and booking, until they walked in
  const saved = arrived.map((t) =>
    Math.max(0, minutesBetween(t.arrivedAt, new Date(Math.max(t.openAt.getTime(), t.createdAt.getTime()))))
  );
  const errors = tokens.map((t) => minutesBetween(t.startedAt, t.bookedServeAt)); // > 0: called later than promised
  const absolute = errors.map((e) => Math.abs(e)).sort((a, b) => a - b);
  const mid = Math.floor(absolute.length / 2);
  const median = absolute.length % 2 ? absolute[mid] : (absolute[mid - 1] + absolute[mid]) / 2;

  return {
    served: tokens.length,
    citizenMinutesSaved: Math.round(saved.reduce((sum, v) => sum + v, 0)),
    avgInOfficeWaitMinutes: round(mean(arrived.map((t) => minutesBetween(t.startedAt, t.arrivedAt)))),
    etaAccuracy:
      tokens.length === 0
        ? null
        : {
            meanErrorMinutes: round(mean(absolute)),
            medianErrorMinutes: Math.round(median),
            within15Pct: Math.round((100 * absolute.filter((e) => e <= 15).length) / absolute.length),
            biasMinutes: round(mean(errors)), // > 0: citizens are called later than promised on average
          },
  };
}
