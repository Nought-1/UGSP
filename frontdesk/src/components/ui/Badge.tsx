import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "done" | "pending" | "cancelled" | "called" | "neutral" | "brand" | "low" | "medium" | "high";
  status?: string;
  size?: "sm" | "md";
}

export function Badge({
  className,
  variant,
  status,
  size = "md",
  children,
  ...props
}: BadgeProps) {
  let computedClass = "bg-cream text-ink border-border";

  if (status && STATUS_COLORS[status as keyof typeof STATUS_COLORS]) {
    computedClass = STATUS_COLORS[status as keyof typeof STATUS_COLORS];
  } else if (variant === "done") {
    computedClass = "bg-status-done-bg text-status-done-text border-status-done-border";
  } else if (variant === "pending") {
    computedClass = "bg-status-pending-bg text-status-pending-text border-status-pending-border";
  } else if (variant === "cancelled") {
    computedClass = "bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-border";
  } else if (variant === "called") {
    computedClass = "bg-status-called-bg text-status-called-text border-status-called-border";
  } else if (variant === "brand") {
    computedClass = "bg-brand/10 text-brand border-brand/20";
  } else if (variant === "low") {
    computedClass = "bg-emerald-100 text-emerald-800 border-emerald-300";
  } else if (variant === "medium") {
    computedClass = "bg-amber-100 text-amber-800 border-amber-300";
  } else if (variant === "high") {
    computedClass = "bg-rose-100 text-rose-800 border-rose-300";
  }

  const sizes = {
    sm: "px-2 py-0.5 text-[11px]",
    md: "px-2.5 py-1 text-xs",
  };

  const label = children || (status ? STATUS_LABELS[status] || status : null);

  return (
    <span
      className={twMerge(
        clsx(
          "inline-flex items-center gap-1 font-semibold border rounded-full uppercase tracking-wider",
          computedClass,
          sizes[size],
          className
        )
      )}
      {...props}
    >
      {label}
    </span>
  );
}
