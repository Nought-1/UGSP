import { cn } from "@/lib/utils";

// "DL-012": service code + token number padded to 3, as printed on the frontdesk slip and board
export function formatTokenLabel(serviceCode: string, tokenNumber: number) {
  return `${serviceCode}-${String(tokenNumber).padStart(3, "0")}`;
}

const SIZES = {
  sm: "px-2 py-0.5 text-sm",
  md: "px-3 py-1 text-xl",
  lg: "px-4 py-2 text-4xl",
};

// Ink block with a cream label, like the stubs in frontdesk's "My tokens"
export function TokenLabel({
  label,
  size = "sm",
  className,
}: {
  label: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center bg-ink font-heading font-semibold tracking-wide text-cream tabular-nums",
        SIZES[size],
        className
      )}
    >
      {label}
    </span>
  );
}
