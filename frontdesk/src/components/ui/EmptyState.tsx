import React from "react";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  icon = <Inbox className="w-12 h-12 text-muted/50" />,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center bg-card border border-dashed border-border rounded-xl space-y-3">
      <div className="p-3 bg-cream rounded-full">{icon}</div>
      <div className="space-y-1 max-w-sm">
        <h3 className="font-heading text-lg font-bold text-ink">{title}</h3>
        {description && <p className="text-xs text-muted leading-relaxed">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
