import React from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular" | "card";
}

export function Skeleton({
  className,
  variant = "rectangular",
  ...props
}: SkeletonProps) {
  const variantStyles = {
    text: "h-4 w-full rounded",
    circular: "rounded-full shrink-0",
    rectangular: "rounded-lg",
    card: "h-32 w-full rounded-xl border border-border",
  };

  return (
    <div
      className={twMerge(
        clsx("animate-pulse bg-border/40", variantStyles[variant], className)
      )}
      {...props}
    />
  );
}
