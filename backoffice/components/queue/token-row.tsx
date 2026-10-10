import { formatWindow, type ConsoleToken } from "@/components/queue/console-data";
import { TokenLabel } from "@/components/queue/token-label";
import { cn } from "@/lib/utils";

// DOM id of a token's row: the search scrolls to it
export const tokenRowId = (tokenId: string) => `token-${tokenId}`;

// "•••• 1234", read out as "phone ending 1234"
export function PhoneTail({ last4 }: { last4: string }) {
  if (!last4) return null;
  return (
    <span className="whitespace-nowrap">
      <span className="sr-only">Phone ending </span>
      <span aria-hidden>•••• </span>
      {last4}
    </span>
  );
}

// The booked arrival window, "09:30–10:00"; nothing for older tokens booked without one
export function SlotWindow({ token }: { token: Pick<ConsoleToken, "slotStart" | "slotEnd"> }) {
  const range = formatWindow(token);
  if (!range) return null;
  return (
    <span className="whitespace-nowrap text-foreground">
      <span className="sr-only">Window </span>
      {range}
    </span>
  );
}

interface TokenRowProps {
  tokenId: string;
  label: string; // "DL-012"
  name: string;
  meta?: React.ReactNode; // phone tail, times, counter
  highlighted?: boolean; // a search match
  children?: React.ReactNode; // actions or a status badge
}

export function TokenRow({ tokenId, label, name, meta, highlighted = false, children }: TokenRowProps) {
  return (
    <li
      id={tokenRowId(tokenId)}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3",
        highlighted && "bg-brand-light ring-2 ring-brand ring-inset"
      )}
    >
      <TokenLabel label={label} />
      {/* min-w: on a narrow column the actions wrap below rather than squeezing the name */}
      <div className="flex min-w-40 flex-1 flex-col gap-0.5">
        <span className="font-semibold break-words">
          {name}
          {highlighted && <span className="sr-only"> (search match)</span>}
        </span>
        {meta && (
          <span className="flex flex-wrap gap-x-2 text-xs text-muted-foreground tabular-nums">{meta}</span>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{children}</div>}
    </li>
  );
}

interface TokenListProps {
  title: string;
  hint: string;
  count: number;
  empty: string; // shown when count is 0
  children: React.ReactNode; // TokenRow items
  className?: string;
}

// A titled card holding a list of token rows
export function TokenList({ title, hint, count, empty, children, className }: TokenListProps) {
  return (
    <section
      aria-label={title}
      className={cn("flex flex-col bg-card text-card-foreground shadow-sm ring-1 ring-foreground/5", className)}
    >
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="font-heading text-lg font-semibold tracking-wide uppercase">{title}</h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        {/* key remounts the number so a change plays the count-fade */}
        <span key={count} className="count-fade font-heading text-3xl leading-none font-semibold tabular-nums">
          {count}
        </span>
      </header>
      {count === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">{children}</ul>
      )}
    </section>
  );
}
