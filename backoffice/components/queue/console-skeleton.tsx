import { Skeleton } from "@/components/ui/skeleton";

// The queue console's shape while the first load runs: service tabs, the hero row, then the two lists
export function ConsoleSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4 md:gap-6">
      <span className="sr-only">Loading your queues</span>
      <Skeleton className="h-10 w-full max-w-md" />

      <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
        <Skeleton className="min-h-56 bg-board-tile" />
        <div className="flex flex-col gap-5 bg-card p-6 shadow-sm ring-1 ring-foreground/5">
          <Skeleton className="h-11 w-48" />
          {/* status line: who is sent to my counter next */}
          <Skeleton className="h-16 w-full" />
          <div className="flex items-center gap-2 border-t pt-4">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="ml-auto h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Skeleton className="col-span-2 h-10 sm:col-span-1" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 md:gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {["arrived", "waiting"].map((list) => (
          <div key={list} className="flex flex-col bg-card shadow-sm ring-1 ring-foreground/5">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-8 w-8" />
            </div>
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ))}
      </div>

      <Skeleton className="h-16 w-full" />
    </div>
  );
}
