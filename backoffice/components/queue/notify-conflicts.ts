import { toast } from "sonner";
import type { QueueConflict } from "@/lib/recompute";

// Warns when a configuration change left booked tokens beyond a queue's new capacity (tokens are kept)
export function notifyConflicts(conflicts: QueueConflict[] | undefined) {
  if (!conflicts?.length) return;
  const lines = conflicts
    .slice(0, 3)
    .map((c) => `${c.serviceName} on ${c.date}: ${c.issued} booked, room for ${c.capacity}`);
  if (conflicts.length > 3) lines.push(`and ${conflicts.length - 3} more`);
  toast.warning(`${conflicts.length} queue${conflicts.length === 1 ? " is" : "s are"} now over capacity`, {
    description: lines.join(". "),
    duration: 10_000,
  });
}
