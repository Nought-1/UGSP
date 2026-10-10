import type { ICitizenToken } from "@/lib/models/CitizenToken";
import type { IServiceQueue } from "@/lib/models/ServiceQueue";
import { cn } from "@/lib/utils";

export type TokenStatus = ICitizenToken["status"];
export type QueueStatus = IServiceQueue["status"];
type Status = TokenStatus | QueueStatus | "NOT_STARTED"; // NOT_STARTED: no queue doc today (nobody booked)

// Same status-to-colour mapping as frontdesk (front/docs/DESIGN-PLAN.md, section 2)
const STYLES: Record<Status, { label: string; className: string }> = {
  WAITING: { label: "Waiting", className: "border-ink text-ink" },
  ARRIVED: { label: "Arrived", className: "border-status-called-border bg-status-called-bg text-status-called" },
  IN_SERVICE: { label: "In service", className: "animate-pulse border-brand bg-brand text-brand-foreground" },
  COMPLETED: { label: "Completed", className: "border-status-done-border bg-status-done-bg text-status-done" },
  NO_SHOW: {
    label: "No-show",
    className: "border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled line-through",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled line-through",
  },
  OPEN: { label: "Open", className: "border-status-done-border bg-status-done-bg text-status-done" },
  PAUSED: { label: "Paused", className: "border-status-pending-border bg-status-pending-bg text-status-pending" },
  CLOSED: { label: "Closed", className: "border-status-cancelled-border bg-status-cancelled-bg text-status-cancelled" },
  NOT_STARTED: { label: "Not started", className: "border-border text-muted-foreground" },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { label, className: tone } = STYLES[status];
  return <span className={cn("stamp", tone, className)}>{label}</span>;
}
