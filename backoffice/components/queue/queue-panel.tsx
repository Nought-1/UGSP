import { CalendarX, CircleCheck, Coffee, Loader2, Lock, Pause, Play, UserCheck } from "lucide-react";
import { CapacityBar } from "@/components/queue/capacity-bar";
import type { ConsoleQueue } from "@/components/queue/console-data";
import { StatusBadge } from "@/components/queue/status-badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QueuePanelProps {
  serviceName: string;
  departmentName: string | null;
  queue: ConsoleQueue | null; // null: nobody has booked today yet
  lastCalled: string | null; // token called last at any counter, e.g. "DL-012"
  away: boolean; // I'm away: nobody is sent to me
  serving: string | null; // my token in service, e.g. "DL-012"
  hasArrived: boolean; // someone in this queue has checked in
  updating: boolean; // queue status change in flight
  onPause: () => void;
  onReopen: () => void;
  onClose: () => void; // asks for confirmation first
}

type StatusInput = Pick<QueuePanelProps, "queue" | "away" | "serving" | "hasArrived">;

// What happens next at my counter, in priority order. Citizens are assigned by the server, never called by hand.
function statusLine({ queue, away, serving, hasArrived }: StatusInput) {
  if (!queue) {
    return {
      text: "Nobody has booked this service today.",
      icon: <CalendarX />,
      tone: "border-border bg-muted/40 text-muted-foreground",
    };
  }
  if (queue.status !== "OPEN") {
    const paused = queue.status === "PAUSED";
    return {
      text: `The queue is ${paused ? "paused" : "closed"}. Reopen it to receive citizens.`,
      icon: paused ? <Pause /> : <Lock />,
      tone: paused
        ? "border-status-pending-border bg-status-pending-bg text-status-pending"
        : "border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled",
    };
  }
  if (away) {
    return {
      text: "You're away. Citizens won't be sent to you.",
      icon: <Coffee />,
      tone: "border-status-pending-border bg-status-pending-bg text-status-pending",
    };
  }
  if (serving) return { text: `Serving ${serving}.`, icon: <UserCheck />, tone: "border-ink text-ink" };
  if (hasArrived) {
    return {
      text: "Assigning the next checked-in citizen…",
      icon: <Loader2 className="animate-spin" />,
      tone: "border-status-called-border bg-status-called-bg text-status-called",
    };
  }
  return {
    text: "You're free. The next checked-in citizen comes to you automatically.",
    icon: <CircleCheck />,
    tone: "border-status-done-border bg-status-done-bg text-status-done",
  };
}

// The selected service's queue: where my counter stands, then the queue's state, controls and numbers
export function QueuePanel({
  serviceName,
  departmentName,
  queue,
  lastCalled,
  away,
  serving,
  hasArrived,
  updating,
  onPause,
  onReopen,
  onClose,
}: QueuePanelProps) {
  const status = statusLine({ queue, away, serving, hasArrived });

  return (
    <section
      aria-label={`${serviceName} queue`}
      className="flex flex-col gap-5 bg-card p-6 text-card-foreground shadow-sm ring-1 ring-foreground/5"
    >
      <div className="flex min-w-0 flex-col gap-1">
        {departmentName && <span className="micro-label">{departmentName}</span>}
        <h2 className="truncate font-heading text-xl font-semibold tracking-wide uppercase">{serviceName}</h2>
      </div>

      <div role="status" className={cn("flex min-h-16 items-center gap-3 border-2 px-4 py-3", status.tone)}>
        <span aria-hidden className="shrink-0 [&_svg]:size-5">
          {status.icon}
        </span>
        <p className="text-sm font-semibold">{status.text}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        <span className="micro-label mr-1">Queue</span>
        <StatusBadge status={queue?.status ?? "NOT_STARTED"} />
        {queue && (
          <div className="ml-auto flex flex-wrap gap-2">
            {queue.status === "OPEN" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onPause}
                disabled={updating}
                aria-label={`Pause the ${serviceName} queue`}
              >
                {updating ? <Loader2 className="animate-spin" /> : <Pause />}
                Pause
              </Button>
            ) : (
              <Button size="sm" onClick={onReopen} disabled={updating} aria-label={`Reopen the ${serviceName} queue`}>
                {updating ? <Loader2 className="animate-spin" /> : <Play />}
                Reopen
              </Button>
            )}
            {queue.status !== "CLOSED" && (
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={updating}
                aria-label={`Close the ${serviceName} queue`}
              >
                <Lock />
                Close
              </Button>
            )}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <dt className="micro-label">Issued / capacity</dt>
          <dd>
            <CapacityBar issued={queue?.issuedCount ?? 0} capacity={queue ? queue.capacity : null} />
          </dd>
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="micro-label">Last called</dt>
          <dd className="font-heading text-lg leading-none font-semibold tabular-nums">{lastCalled ?? "—"}</dd>
        </div>
        <div className="flex flex-col gap-1.5">
          <dt className="micro-label">Completed</dt>
          <dd className="font-heading text-lg leading-none font-semibold tabular-nums">
            {queue?.completedCount ?? 0}
          </dd>
        </div>
      </dl>
    </section>
  );
}
