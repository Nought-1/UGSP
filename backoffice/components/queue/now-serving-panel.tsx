import { cn } from "@/lib/utils";

interface NowServingPanelProps {
  label: string | null; // token in service, e.g. "DL-012"; null when nobody is
  counterNumber?: number | null;
  citizenName?: string | null;
  children?: React.ReactNode; // actions, e.g. Complete
  className?: string;
}

// Board-style dark panel, echoing the frontdesk TV board (railway departure board)
export function NowServingPanel({ label, counterNumber, citizenName, children, className }: NowServingPanelProps) {
  return (
    <section
      aria-label="Now serving"
      className={cn(
        "flex flex-col bg-board-bg text-board-digit [--micro-label-color:var(--color-board-dim)]",
        className
      )}
    >
      {/* Top strip turns brand red for 10s whenever the token changes (remounted by key) */}
      <div key={label ?? "none"} className="board-flash h-1 bg-board-rule" />
      <div className="flex flex-col gap-3 p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="micro-label">Now serving</span>
          {counterNumber != null && (
            <span className="micro-label">Counter {String(counterNumber).padStart(2, "0")}</span>
          )}
        </div>
        <span
          key={label ?? "none"}
          className="count-fade font-heading text-[clamp(48px,6vw,96px)] leading-none font-bold tabular-nums"
        >
          {label ?? "— —"}
        </span>
        <span className="text-sm text-board-dim">{label ? (citizenName ?? "") : "Nobody in service"}</span>
        {children && <div className="flex flex-wrap gap-2 pt-1">{children}</div>}
      </div>
    </section>
  );
}
