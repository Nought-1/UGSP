// Backoffice session cookie. Cookies ignore the port, so on localhost the default "next-auth.session-token"
// would be shared with frontdesk (which uses "fd.session-token"). Read by lib/auth.ts and proxy.ts.
export const SESSION_COOKIE = "bo.session-token";
