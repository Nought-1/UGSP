// Queue console data: the shapes GET /api/v1/queues returns, and pure helpers for the page
import type { QueueStatus, TokenStatus } from "@/components/queue/status-badge";
import { formatTokenLabel } from "@/components/queue/token-label";

export interface ConsoleToken {
  _id: string;
  tokenNumber: number;
  status: TokenStatus;
  citizenName: string;
  phoneLast4: string; // staff only ever see the last 4 digits
  slotStart: string | null; // "HH:mm" start of the booked arrival window; null on tokens booked before windows
  slotEnd: string | null; // "HH:mm"
  estimatedServeAt: string; // ISO
  comeEarlyAt: string | null; // ISO: when an officer asked the citizen to come now (once per token)
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  servedById: string | null;
  counterNumber: number | null;
}

export interface ConsoleQueue {
  _id: string;
  status: QueueStatus;
  issuedCount: number;
  capacity: number;
  nowServing: number; // token number called last (not the highest)
  completedCount: number;
}

export interface ConsoleService {
  service: { _id: string; name: string; code: string };
  department: { _id: string; name: string; timezone: string } | null;
  date: string; // YYYY-MM-DD, today in the department's time zone
  queue: ConsoleQueue | null; // null: nobody has booked this service for today yet
  // Serving order, as the server sends it: window, then token number (tokens without a window first). Never re-sorted.
  tokens: ConsoleToken[];
  myToken: ConsoleToken | null; // my IN_SERVICE token; the GET itself assigns me the next checked-in citizen when I'm free
}

export interface ConsoleData {
  me: { _id: string; name: string; counterNumber: number | null; away: boolean };
  services: ConsoleService[];
  matches: string[]; // ids of the tokens matching ?q=
}

// A token as PATCH /tokens/:id returns it (the raw document, or only the changed fields)
export type TokenUpdate = Pick<ConsoleToken, "_id" | "status"> &
  Partial<
    Pick<ConsoleToken, "arrivedAt" | "startedAt" | "completedAt" | "servedById" | "counterNumber" | "comeEarlyAt">
  >;

// These fields are only ever set, never cleared, so a missing one keeps what the screen had
export function applyTokenUpdate(token: ConsoleToken, update: TokenUpdate): ConsoleToken {
  return {
    ...token,
    status: update.status,
    comeEarlyAt: update.comeEarlyAt ?? token.comeEarlyAt,
    arrivedAt: update.arrivedAt ?? token.arrivedAt,
    startedAt: update.startedAt ?? token.startedAt,
    completedAt: update.completedAt ?? token.completedAt,
    servedById: update.servedById ?? token.servedById,
    counterNumber: update.counterNumber ?? token.counterNumber,
  };
}

// The GET can assign me a citizen while it runs: make the token list agree with myToken, so every view uses one source
export function withMyToken(view: ConsoleService): ConsoleService {
  const mine = view.myToken;
  if (!mine) return view;
  return { ...view, tokens: view.tokens.map((t) => (t._id === mine._id ? mine : t)) };
}

export interface TokenGroups {
  mine: ConsoleToken | null; // IN_SERVICE at my counter (the API's myToken rule)
  arrived: ConsoleToken[]; // checked in, waiting to be assigned
  waiting: ConsoleToken[]; // booked, not here yet
  elsewhere: ConsoleToken[]; // IN_SERVICE with other officers
  done: ConsoleToken[]; // COMPLETED, NO_SHOW, CANCELLED
}

// Server (serving) order is kept in every group, so arrived[0] is the next citizen to be assigned
export function groupTokens(tokens: ConsoleToken[], meId: string): TokenGroups {
  const groups: TokenGroups = { mine: null, arrived: [], waiting: [], elsewhere: [], done: [] };
  for (const token of tokens) {
    if (token.status === "ARRIVED") groups.arrived.push(token);
    else if (token.status === "WAITING") groups.waiting.push(token);
    else if (token.status !== "IN_SERVICE") groups.done.push(token);
    else if (token.servedById === meId) groups.mine = token;
    else groups.elsewhere.push(token);
  }
  return groups;
}

export interface MyToken {
  view: ConsoleService; // the service it belongs to
  token: ConsoleToken;
  label: string; // "DL-012"
}

// An officer serves one token at a time across all services (the API allows one IN_SERVICE per officer per day)
export function findMine(services: ConsoleService[], meId: string): MyToken | null {
  for (const view of services) {
    const token = view.tokens.find((t) => t.status === "IN_SERVICE" && t.servedById === meId);
    if (token) return { view, token, label: formatTokenLabel(view.service.code, token.tokenNumber) };
  }
  return null;
}

// The tab count: everyone still to be served (booked or already here)
export const waitingCount = (tokens: ConsoleToken[]) =>
  tokens.filter((t) => t.status === "WAITING" || t.status === "ARRIVED").length;

export const counterLabel = (counterNumber: number) => `Counter ${String(counterNumber).padStart(2, "0")}`;

// "09:30–10:00": the booked arrival window, already in the department's local time. null for older tokens.
export function formatWindow(token: Pick<ConsoleToken, "slotStart" | "slotEnd">) {
  if (!token.slotStart) return null;
  return token.slotEnd ? `${token.slotStart}–${token.slotEnd}` : token.slotStart;
}

const clocks = new Map<string, Intl.DateTimeFormat>();

function clockFor(timeZone: string) {
  let clock = clocks.get(timeZone);
  if (!clock) {
    const options = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
    try {
      clock = new Intl.DateTimeFormat("en-IN", { ...options, timeZone });
    } catch {
      clock = new Intl.DateTimeFormat("en-IN", { ...options, timeZone: "UTC" }); // unknown zone
    }
    clocks.set(timeZone, clock);
  }
  return clock;
}

// "14:05" in the department's time zone, never the browser's. Only formats a given instant (no clock reads).
export function formatClock(iso: string | null, timeZone: string) {
  const ms = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(ms) ? null : clockFor(timeZone).format(ms);
}
