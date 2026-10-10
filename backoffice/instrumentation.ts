// Starts the log-only notifier (lib/notifier.ts) with the Node.js server. register() only schedules the work and
// never waits on the database. Next also loads this file in the build workers, so the build phase is skipped.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { startNotifier } = await import("./lib/notifier");
  startNotifier();
}
