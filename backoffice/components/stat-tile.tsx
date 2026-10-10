import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number | undefined; // undefined while loading
  hint?: React.ReactNode;
  icon?: LucideIcon;
  children?: React.ReactNode; // extra slot, e.g. a CapacityBar or a badge
  className?: string;
}

export function StatTile({ label, value, hint, icon: Icon, children, className }: StatTileProps) {
  return (
    <div className={cn("flex flex-col gap-3 bg-card p-5 text-card-foreground shadow-sm ring-1 ring-foreground/5", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="micro-label">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      </div>
      {value === undefined ? (
        <Skeleton className="h-10 w-20" />
      ) : (
        // key remounts the number so a change plays the count-fade
        <span key={value} className="count-fade font-heading text-4xl leading-none font-semibold tabular-nums">
          {value}
        </span>
      )}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
