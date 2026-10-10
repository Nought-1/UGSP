// Route response helpers for the { ok, data } | { ok: false, error: { code, message } } envelope.
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "PHONE_TAKEN"
  | "DATE_NOT_BOOKABLE"
  | "DATE_FULL"
  | "ALREADY_BOOKED"
  | "NOT_CANCELLABLE"
  | "INTERNAL";

// Thrown by lib code (booking.ts) for expected failures; handleError turns it into a response.
// `extra` lands next to code/message, e.g. { tokenId } with ALREADY_BOOKED.
export class RouteError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 409,
    public extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(code: ErrorCode, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: { ...extra, code, message } }, { status });
}

export const unauthorized = () => fail("UNAUTHORIZED", "Please sign in to continue", 401);

export function handleError(err: unknown, where: string) {
  if (err instanceof RouteError) return fail(err.code, err.message, err.status, err.extra);
  if (err instanceof ZodError) {
    return fail("VALIDATION", err.issues[0]?.message ?? "Invalid input", 400);
  }
  console.error(`${where} error:`, err);
  return fail("INTERNAL", "Something went wrong. Please try again.", 500);
}
