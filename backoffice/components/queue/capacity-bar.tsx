import type { CapacityReason } from "@/lib/queue-core";
import { cn } from "@/lib/utils";

const CLOSED_LABELS: Record<CapacityReason, string> = {
  DEPT_INACTIVE: "Office inactive",
  WEEK_OFF: "Week off",
  HOLIDAY: "Holiday",
  SERVICE_INACTIVE: "Service off",
  NO_STAFF: "No staff",
};

interface CapacityBarProps {
  issued: number;
  capacity: number | null; // null: nobody has booked for this day yet (no queue doc)
  closedReason?: CapacityReason | null;
  className?: string;
}

const redStamp = "stamp border-status-cancelled-border text-status-cancelled";

export function CapacityBar({ issued, capacity, closedReason, className }: CapacityBarProps) {
  if (closedReason) return <span className={cn(redStamp, className)}>{CLOSED_LABELS[closedReason]}</span>;
  if (capacity === null) return <span className={cn("text-xs text-muted-foreground", className)}>No bookings yet</span>;
  if (capacity === 0) return <span className={cn(redStamp, className)}>No capacity</span>;

  const ratio = issued / capacity;
  const over = issued > capacity;
  const fill = over ? "bg-status-cancelled" : ratio >= 0.9 ? "bg-status-pending" : "bg-ink";

  return (
    <div className={cn("flex min-w-28 flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
        <span>
          {issued} / {capacity}
        </span>
        {over && <span className={cn(redStamp, "border px-1 py-0 text-[10px]")}>Over</span>}
      </div>
      <div
        role="meter"
        aria-label={`${issued} of ${capacity} tokens issued`}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-valuenow={issued}
        className="h-1.5 w-full bg-muted"
      >
        <div className={cn("h-full", fill)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
    </div>
  );
}
