// Brand: UGSP - Unified Government Service Platform (the full name is translated: "app.fullName" in i18n.ts)
export const APP_NAME = "UGSP";
export const APP_FULL_NAME = "Unified Government Service Platform";

// NextAuth session cookie. Own name because cookies ignore the port, so on localhost
// backoffice's default next-auth.* cookie would overwrite ours. Read by auth.ts and middleware.ts.
export const SESSION_COOKIE = "fd.session-token";

// <Badge status="..."> colours for token statuses (screens use the StatusStamp; labels there are translated)
export const STATUS_COLORS = {
  WAITING: "bg-cream text-ink border-border-dark",
  ARRIVED: "bg-status-called-bg text-status-called-text border-status-called-border",
  IN_SERVICE: "bg-brand/10 text-brand border-brand/30",
  COMPLETED: "bg-status-done-bg text-status-done-text border-status-done-border",
  NO_SHOW: "bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-border",
  CANCELLED: "bg-status-cancelled-bg text-status-cancelled-text border-status-cancelled-border",
};

export const STATUS_LABELS: Record<string, string> = {
  WAITING: "Waiting",
  ARRIVED: "Arrived",
  IN_SERVICE: "In service",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
  CANCELLED: "Cancelled",
};
