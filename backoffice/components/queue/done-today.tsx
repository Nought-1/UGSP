"use client";

import { ChevronDown } from "lucide-react";
import { counterLabel, formatClock, type ConsoleToken } from "@/components/queue/console-data";
import { StatusBadge } from "@/components/queue/status-badge";
import { formatTokenLabel } from "@/components/queue/token-label";
import { PhoneTail, TokenRow } from "@/components/queue/token-row";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DoneTodayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tokens: ConsoleToken[]; // COMPLETED, NO_SHOW and CANCELLED
  serviceCode: string;
  timeZone: string;
  matches: ReadonlySet<string>; // search hits to highlight
}

// Finished tokens, collapsed by default so the live lists stay on top
export function DoneToday({ open, onOpenChange, tokens, serviceCode, timeZone, matches }: DoneTodayProps) {
  const count = (status: ConsoleToken["status"]) => tokens.filter((t) => t.status === status).length;

  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="bg-card text-card-foreground shadow-sm ring-1 ring-foreground/5"
    >
      <h2>
        <CollapsibleTrigger className="group/done flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-heading text-lg font-semibold tracking-wide uppercase">Done today</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {count("COMPLETED")} completed · {count("NO_SHOW")} no-show · {count("CANCELLED")} cancelled
            </span>
          </span>
          <span className="flex items-center gap-3">
            <span className="font-heading text-3xl leading-none font-semibold tabular-nums">{tokens.length}</span>
            <ChevronDown
              aria-hidden
              className="size-4 text-muted-foreground transition-transform group-data-panel-open/done:rotate-180"
            />
          </span>
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>
        {tokens.length === 0 ? (
          <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
            Completed, no-show and cancelled tokens show up here.
          </p>
        ) : (
          <ul className="divide-y border-t">
            {tokens.map((token) => {
              const completedAt = token.status === "COMPLETED" ? formatClock(token.completedAt, timeZone) : null;
              return (
                <TokenRow
                  key={token._id}
                  tokenId={token._id}
                  label={formatTokenLabel(serviceCode, token.tokenNumber)}
                  name={token.citizenName}
                  highlighted={matches.has(token._id)}
                  meta={
                    <>
                      <PhoneTail last4={token.phoneLast4} />
                      {completedAt && <span>Completed {completedAt}</span>}
                      {token.status === "COMPLETED" && token.counterNumber != null && (
                        <span>{counterLabel(token.counterNumber)}</span>
                      )}
                    </>
                  }
                >
                  <StatusBadge status={token.status} />
                </TokenRow>
              );
            })}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
