"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { BellRing, Check, Coffee, ListOrdered, Loader2, Search, Ticket, UserCheck, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import {
  applyTokenUpdate,
  counterLabel,
  findMine,
  formatClock,
  formatWindow,
  groupTokens,
  waitingCount,
  withMyToken,
  type ConsoleData,
  type ConsoleQueue,
  type ConsoleService,
  type ConsoleToken,
  type TokenUpdate,
} from "@/components/queue/console-data";
import { ConsoleSkeleton } from "@/components/queue/console-skeleton";
import { DoneToday } from "@/components/queue/done-today";
import { LiveBadge } from "@/components/queue/live-badge";
import { NowServingPanel } from "@/components/queue/now-serving-panel";
import { QueuePanel } from "@/components/queue/queue-panel";
import type { QueueStatus } from "@/components/queue/status-badge";
import { formatTokenLabel, TokenLabel } from "@/components/queue/token-label";
import { PhoneTail, SlotWindow, TokenList, TokenRow, tokenRowId } from "@/components/queue/token-row";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const REFRESH_MS = 10_000;
const SEARCH_DELAY_MS = 300;
const TIMEOUT_MS = 15_000; // a hung request must not stall the poll (it skips while one is in flight)

type TokenAction = "arrive" | "complete" | "no_show" | "cancel" | "come_early";
type QueueAction = "pause" | "open" | "close";

// A committed search. n changes on every commit, so pressing Enter again jumps to the match again.
interface SearchQuery {
  q: string; // digits only: a token number, or the last 4+ digits of a phone
  n: number;
}

interface Loaded extends ConsoleData {
  searchedFor: string; // the q that `matches` belong to
}

// Irreversible actions wait in the confirm dialog
type Confirmation =
  | { kind: "no_show"; token: ConsoleToken; label: string; serving: boolean } // serving: my own token in service
  | { kind: "cancel"; token: ConsoleToken; label: string }
  | { kind: "close"; queue: ConsoleQueue; serviceName: string };

const digitsOf = (value: string) => value.replace(/\D/g, "");
const messageOf = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong. Please try again.");

// Same-origin JSON call (the session cookie goes along). Failures throw the API's { error } message.
async function request<T>(url: string, method: "GET" | "PATCH" = "GET", body?: object): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error("Can't reach the server. Check the connection.");
  }
  if (res.status === 401) throw new Error("Your session has ended. Sign in again to continue.");
  const json = await res.json().catch(() => null);
  if (!res.ok || json === null) throw new Error(json?.error ?? "Something went wrong. Please try again.");
  return json as T;
}

function confirmCopy(
  confirmation: Confirmation | null
): Pick<React.ComponentProps<typeof ConfirmDialog>, "title" | "description" | "confirmLabel" | "variant"> {
  if (!confirmation) return { title: "" };
  if (confirmation.kind === "close") {
    return {
      title: `Close the ${confirmation.serviceName} queue?`,
      description: "No more bookings, and nobody is sent to a counter, until it is reopened. Tokens already booked are kept.",
      confirmLabel: "Close queue",
      variant: "danger",
    };
  }
  if (confirmation.kind === "cancel") {
    return {
      title: `Cancel ${confirmation.label}?`,
      description: `${confirmation.token.citizenName}'s booking is cancelled and the slot is freed for someone else. This can't be undone.`,
      confirmLabel: "Cancel token",
      variant: "danger",
    };
  }
  if (confirmation.serving) {
    return {
      title: `Mark ${confirmation.label} as no-show?`,
      description: "They lose their turn and the next checked-in citizen comes to you.",
      confirmLabel: "No-show",
      variant: "danger",
    };
  }
  return {
    title: `Mark ${confirmation.label} as no-show?`,
    description: `${confirmation.token.citizenName} loses their turn for today. This can't be undone.`,
    confirmLabel: "No-show",
  };
}

export default function OfficerQueuePage() {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0); // bump to refetch right away (after every action)

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState<SearchQuery>({ q: "", n: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null); // service tab, kept across polls
  const [doneOpen, setDoneOpen] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<{ tokenId: string } | null>(null);

  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set()); // requests in flight, by token or queue
  const [awayRequest, setAwayRequest] = useState<boolean | null>(null); // Away value being saved, shown at once
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false); // separate, so the copy stays while the dialog closes

  // Bumped by every local update: a poll that started before it may carry older data, so it is dropped
  const version = useRef(0);
  const jumpedFor = useRef<SearchQuery | null>(null); // the search whose first match was already shown

  // First result of a new search: open the tab (and the Done list) holding the first match, then scroll to it.
  // A match in the open tab wins over one in another tab.
  const showFirstMatch = useEffectEvent((json: ConsoleData) => {
    const hits = new Set(json.matches);
    const open = json.services.find((s) => s.service._id === selectedId) ?? json.services[0];
    const target = [open, ...json.services].find((s) => s?.tokens.some((t) => hits.has(t._id)));
    if (!target) return;
    const groups = groupTokens(target.tokens, json.me._id);
    const first = [groups.mine, ...groups.arrived, ...groups.waiting, ...groups.elsewhere, ...groups.done].find(
      (t) => t !== null && hits.has(t._id)
    );
    if (!first) return;
    setSelectedId(target.service._id);
    if (groups.done.includes(first)) setDoneOpen(true);
    setScrollTarget({ tokenId: first._id });
  });

  // Poll every 10 s; reloadKey and the search restart it with an immediate fetch.
  // Each GET also assigns me the next checked-in citizen when I'm free, so a refetch is how citizens arrive.
  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function load() {
      if (inFlight) return; // a slow reply: skip this tick instead of piling up requests
      inFlight = true;
      const startedAt = version.current;
      try {
        const url = query.q ? `/api/v1/queues?q=${encodeURIComponent(query.q)}` : "/api/v1/queues";
        const json = await request<ConsoleData>(url);
        // An action updated the screen meanwhile; its own reload brings fresher data
        if (cancelled || startedAt !== version.current) return;
        const loaded: Loaded = { ...json, services: json.services.map(withMyToken), searchedFor: query.q };
        setData(loaded);
        setError(null);
        setUpdatedAt(Date.now());
        if (query.q && jumpedFor.current !== query) {
          jumpedFor.current = query;
          showFirstMatch(loaded);
        }
      } catch (err) {
        if (!cancelled) setError(messageOf(err));
      } finally {
        inFlight = false;
      }
    }

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [reloadKey, query]);

  // Typing searches after a short pause; Enter searches at once
  useEffect(() => {
    const q = digitsOf(search);
    const timer = setTimeout(() => setQuery((prev) => (prev.q === q ? prev : { q, n: prev.n + 1 })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!scrollTarget) return;
    // Next frame: the tab or the Done list holding the row has just been opened
    const frame = requestAnimationFrame(() => {
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document
        .getElementById(tokenRowId(scrollTarget.tokenId))
        ?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollTarget]);

  const reload = () => setReloadKey((key) => key + 1);

  function markBusy(key: string, on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // Local updates show a confirmed change at once; the reload that follows brings the rest (and my next citizen)
  function patchData(update: (prev: Loaded) => Loaded) {
    version.current += 1;
    setData((prev) => prev && update(prev));
  }

  const patchToken = (update: TokenUpdate) =>
    patchData((prev) => ({
      ...prev,
      services: prev.services.map((s) => ({
        ...s,
        tokens: s.tokens.map((t) => (t._id === update._id ? applyTokenUpdate(t, update) : t)),
      })),
    }));

  const patchQueue = (queueId: string, status: QueueStatus) =>
    patchData((prev) => ({
      ...prev,
      services: prev.services.map((s) => (s.queue?._id === queueId ? { ...s, queue: { ...s.queue, status } } : s)),
    }));

  async function tokenAction(token: ConsoleToken, action: TokenAction) {
    markBusy(token._id, true);
    try {
      const json = await request<{ token: TokenUpdate }>(`/api/v1/tokens/${token._id}`, "PATCH", { action });
      patchToken(json.token);
    } finally {
      markBusy(token._id, false);
      reload(); // also after a 409: the screen was stale
    }
  }

  async function queueAction(queue: ConsoleQueue, action: QueueAction) {
    const key = `queue:${queue._id}`;
    markBusy(key, true);
    try {
      const json = await request<{ queue: { status: QueueStatus } }>(`/api/v1/queues/${queue._id}`, "PATCH", {
        action,
      });
      patchQueue(queue._id, json.queue.status);
    } finally {
      markBusy(key, false);
      reload();
    }
  }

  async function changeAway(away: boolean) {
    setAwayRequest(away);
    try {
      const json = await request<{ away?: boolean }>("/api/v1/me", "PATCH", { away });
      const saved = json.away ?? away;
      patchData((prev) => ({ ...prev, me: { ...prev.me, away: saved } }));
    } catch (err) {
      toast.error(messageOf(err));
    } finally {
      setAwayRequest(null);
      reload(); // coming back may bring a citizen straight away
    }
  }

  function markArrived(token: ConsoleToken, label: string) {
    tokenAction(token, "arrive").then(
      () => toast.success(`${label} marked arrived`),
      (err) => toast.error(messageOf(err))
    );
  }

  function askToComeNow(token: ConsoleToken, label: string) {
    tokenAction(token, "come_early").then(
      () => toast.success(`Asked ${label} to come now`),
      (err) => toast.error(messageOf(err))
    );
  }

  function complete(token: ConsoleToken, label: string) {
    tokenAction(token, "complete").then(
      () => toast.success(`${label} completed`),
      (err) => toast.error(messageOf(err))
    );
  }

  function changeQueue(queue: ConsoleQueue, action: "pause" | "open", serviceName: string) {
    queueAction(queue, action).then(
      () => toast.success(`${serviceName} queue ${action === "pause" ? "paused" : "reopened"}`),
      (err) => toast.error(messageOf(err))
    );
  }

  function ask(next: Confirmation) {
    setConfirmation(next);
    setConfirmOpen(true);
  }

  // Runs inside the confirm dialog: a thrown error is shown there
  async function confirmAction() {
    if (!confirmation) return;
    if (confirmation.kind === "close") {
      await queueAction(confirmation.queue, "close");
      toast.success(`${confirmation.serviceName} queue closed`);
    } else {
      await tokenAction(confirmation.token, confirmation.kind);
      toast.success(`${confirmation.label} ${confirmation.kind === "cancel" ? "cancelled" : "marked no-show"}`);
    }
  }

  function searchNow() {
    const q = digitsOf(search);
    setQuery((prev) => (q || prev.q ? { q, n: prev.n + 1 } : prev));
  }

  function clearSearch() {
    setSearch("");
    setQuery((prev) => (prev.q ? { q: "", n: prev.n + 1 } : prev));
  }

  const services = data?.services ?? [];
  const meId = data?.me._id ?? "";
  const myCounter = data?.me.counterNumber ?? null;
  const away = awayRequest ?? data?.me.away ?? false;
  const current: ConsoleService | undefined = services.find((s) => s.service._id === selectedId) ?? services[0];
  const mine = findMine(services, meId);
  // Highlights belong to the search on screen only
  const matches: ReadonlySet<string> = new Set(query.q && data?.searchedFor === query.q ? data.matches : []);

  const digits = digitsOf(search);
  const searchNote = !search.trim()
    ? null
    : !digits
      ? "Numbers only"
      : data?.searchedFor !== digits
        ? "Searching…"
        : data.matches.length === 0
          ? "No match"
          : `${data.matches.length} ${data.matches.length === 1 ? "match" : "matches"}`;

  function renderService(view: ConsoleService) {
    const { code } = view.service;
    const timeZone = view.department?.timezone ?? "UTC";
    const queue = view.queue;
    const groups = groupTokens(view.tokens, meId);
    const labelOf = (token: ConsoleToken) => formatTokenLabel(code, token.tokenNumber);
    const servingBusy = mine !== null && busy.has(mine.token._id);

    return (
      <>
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* My counter: one token in service at a time, whichever service it belongs to */}
          <div
            id={mine ? tokenRowId(mine.token._id) : undefined}
            className={cn(mine && matches.has(mine.token._id) && "ring-2 ring-brand ring-offset-2 ring-offset-background")}
          >
            <NowServingPanel
              className="h-full"
              label={mine?.label ?? null}
              counterNumber={mine?.token.counterNumber ?? myCounter}
              citizenName={
                mine &&
                [mine.token.citizenName, mine.view === view ? null : mine.view.service.name, formatWindow(mine.token)]
                  .filter(Boolean)
                  .join(" · ")
              }
            >
              {mine && (
                <>
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => complete(mine.token, mine.label)}
                    disabled={servingBusy}
                    aria-label={`Complete ${mine.label}`}
                  >
                    {servingBusy ? <Loader2 className="animate-spin" /> : <Check />}
                    Complete
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-board-dim text-board-digit hover:bg-board-tile hover:text-board-digit"
                    onClick={() => ask({ kind: "no_show", token: mine.token, label: mine.label, serving: true })}
                    disabled={servingBusy}
                    aria-label={`Mark ${mine.label} as no-show`}
                  >
                    <UserX />
                    No-show
                  </Button>
                </>
              )}
            </NowServingPanel>
          </div>

          <QueuePanel
            serviceName={view.service.name}
            departmentName={view.department?.name ?? null}
            queue={queue}
            lastCalled={queue?.nowServing ? formatTokenLabel(code, queue.nowServing) : null}
            away={away}
            serving={mine?.label ?? null}
            hasArrived={groups.arrived.length > 0}
            updating={queue !== null && busy.has(`queue:${queue._id}`)}
            onPause={() => queue && changeQueue(queue, "pause", view.service.name)}
            onReopen={() => queue && changeQueue(queue, "open", view.service.name)}
            onClose={() => queue && ask({ kind: "close", queue, serviceName: view.service.name })}
          />
        </div>

        {!queue ? (
          <Empty className="border bg-card">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Ticket />
              </EmptyMedia>
              <EmptyTitle>No tokens booked for today</EmptyTitle>
              <EmptyDescription>The queue starts with the first booking.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <>
            {/* Waiting rows carry more actions, so that column gets more room */}
            <div className="grid items-start gap-4 md:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <TokenList
                title="Arrived"
                hint="Checked in. Earliest window is served first."
                count={groups.arrived.length}
                empty="Nobody has checked in yet."
              >
                {groups.arrived.map((token) => {
                  const label = labelOf(token);
                  const arrivedAt = formatClock(token.arrivedAt, timeZone);
                  return (
                    <TokenRow
                      key={token._id}
                      tokenId={token._id}
                      label={label}
                      name={token.citizenName}
                      highlighted={matches.has(token._id)}
                      meta={
                        <>
                          <PhoneTail last4={token.phoneLast4} />
                          <SlotWindow token={token} />
                          {arrivedAt && <span>Arrived {arrivedAt}</span>}
                        </>
                      }
                    >
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => ask({ kind: "no_show", token, label, serving: false })}
                        disabled={busy.has(token._id)}
                        aria-label={`Mark ${label} as no-show`}
                      >
                        <UserX />
                        No-show
                      </Button>
                    </TokenRow>
                  );
                })}
              </TokenList>

              <TokenList
                title="Waiting"
                hint="Booked, not here yet, in window order."
                count={groups.waiting.length}
                empty="Nobody else is booked for today."
              >
                {groups.waiting.map((token) => {
                  const label = labelOf(token);
                  const eta = formatClock(token.estimatedServeAt, timeZone);
                  const askedAt = formatClock(token.comeEarlyAt, timeZone);
                  const pending = busy.has(token._id);
                  return (
                    <TokenRow
                      key={token._id}
                      tokenId={token._id}
                      label={label}
                      name={token.citizenName}
                      highlighted={matches.has(token._id)}
                      meta={
                        <>
                          <PhoneTail last4={token.phoneLast4} />
                          <SlotWindow token={token} />
                          {eta && <span>ETA {eta}</span>}
                          {askedAt && <span>Asked {askedAt}</span>}
                        </>
                      }
                    >
                      <Button
                        size="xs"
                        onClick={() => markArrived(token, label)}
                        disabled={pending}
                        aria-label={`Mark ${label} arrived`}
                      >
                        {pending ? <Loader2 className="animate-spin" /> : <UserCheck />}
                        Mark arrived
                      </Button>
                      {/* Once per token, and only while the queue is open */}
                      {queue.status === "OPEN" && !token.comeEarlyAt && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => askToComeNow(token, label)}
                          disabled={pending}
                          aria-label={`Ask ${label} to come now`}
                        >
                          <BellRing />
                          Ask to come now
                        </Button>
                      )}
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => ask({ kind: "no_show", token, label, serving: false })}
                        disabled={pending}
                        aria-label={`Mark ${label} as no-show`}
                      >
                        No-show
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => ask({ kind: "cancel", token, label })}
                        disabled={pending}
                        aria-label={`Cancel ${label}`}
                      >
                        Cancel
                      </Button>
                    </TokenRow>
                  );
                })}
              </TokenList>
            </div>

            {groups.elsewhere.length > 0 && (
              <section
                aria-label="In service with other officers"
                className="flex flex-col gap-3 bg-card px-4 py-3 text-card-foreground shadow-sm ring-1 ring-foreground/5 sm:flex-row sm:items-center"
              >
                <h2 className="micro-label shrink-0">With other officers</h2>
                <ul className="flex flex-wrap gap-x-5 gap-y-2">
                  {groups.elsewhere.map((token) => (
                    <li
                      key={token._id}
                      id={tokenRowId(token._id)}
                      className={cn(
                        "flex items-center gap-2",
                        matches.has(token._id) && "ring-2 ring-brand ring-offset-2 ring-offset-card"
                      )}
                    >
                      <TokenLabel label={labelOf(token)} />
                      <span className="font-medium">{token.citizenName}</span>
                      <span className="flex gap-2 text-xs text-muted-foreground tabular-nums">
                        <SlotWindow token={token} />
                        {token.counterNumber != null ? counterLabel(token.counterNumber) : "No counter"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <DoneToday
              open={doneOpen}
              onOpenChange={setDoneOpen}
              tokens={groups.done}
              serviceCode={code}
              timeZone={timeZone}
              matches={matches}
            />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        className="reveal"
        kicker="Operations"
        title="Queue console"
        description="Check citizens in, serve whoever is sent to your counter and close out today's tokens."
        actions={
          <>
            <LiveBadge updatedAt={updatedAt} paused={error !== null} />
            <div className="flex items-center gap-2">
              <Switch
                id="officer-away"
                checked={away}
                // Shown at once; further toggles wait until the save settles (disabling would drop keyboard focus)
                onCheckedChange={(checked) => {
                  if (awayRequest === null) changeAway(checked);
                }}
                disabled={!data}
              />
              <Label htmlFor="officer-away">Away</Label>
            </div>
            <div className="relative w-60">
              <Search aria-hidden className="pointer-events-none absolute top-2.5 left-0 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") searchNow();
                  else if (e.key === "Escape") clearSearch();
                }}
                placeholder="Token no. or phone"
                aria-label="Find a token by its number or the last 4 digits of a phone"
                autoComplete="off"
                className="pr-8 pl-6"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute top-1.5 right-0"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <X />
                </Button>
              )}
            </div>
            <span className="micro-label whitespace-nowrap" aria-live="polite">
              {searchNote}
            </span>
          </>
        }
      />

      {away && (
        <div
          role="status"
          className="flex items-center gap-3 border border-status-pending-border bg-status-pending-bg px-4 py-3 text-sm text-status-pending"
        >
          <Coffee aria-hidden className="size-4 shrink-0" />
          {"You're away. Citizens won't be sent to you. Switch off Away when you're back."}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border border-status-cancelled-border bg-status-cancelled-bg px-4 py-3 text-sm text-status-cancelled"
        >
          {error}
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      {!data ? (
        <ConsoleSkeleton />
      ) : !current ? (
        <Empty className="reveal border bg-card [--i:1]">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListOrdered />
            </EmptyMedia>
            <EmptyTitle>No services assigned</EmptyTitle>
            <EmptyDescription>Ask an admin to assign you.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Tabs
          value={current.service._id}
          onValueChange={(value) => {
            if (typeof value === "string") setSelectedId(value);
          }}
          className="reveal gap-4 [--i:1] md:gap-6"
        >
          <div className="max-w-full overflow-x-auto">
            <TabsList aria-label="Your services">
              {services.map((view) => {
                const count = waitingCount(view.tokens);
                return (
                  <TabsTrigger key={view.service._id} value={view.service._id}>
                    {view.service.name}
                    <span
                      className={cn(
                        "min-w-5 px-1 py-0.5 text-center font-heading text-[11px] leading-none tabular-nums",
                        count > 0 ? "bg-ink text-cream" : "bg-foreground/10 text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                    <span className="sr-only">waiting</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          {/* One panel that follows the selected tab, so the hero (and its flash) survives tab switches */}
          <TabsContent value={current.service._id} className="flex flex-col gap-4 md:gap-6">
            {renderService(current)}
          </TabsContent>
        </Tabs>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={confirmAction}
        {...confirmCopy(confirmation)}
      />
    </>
  );
}
