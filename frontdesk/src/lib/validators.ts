// zod schemas shared by react-hook-form (client) and route handlers (server).
// Messages are i18n keys ("v.*" in i18n.ts): forms show them with useT().tm, and API VALIDATION errors
// carry the key, which the client translates.
import { z } from "zod";

export const NOTIFY_CHANNELS = ["SMS", "WHATSAPP", "EMAIL"] as const;

// Accepts "+919876543210", "98765 43210" or "+91-98765-43210" and outputs E.164 (needed for SMS/WhatsApp).
// ponytail: a bare 10-digit number defaults to +91 (all offices are in India); add a country picker if that changes.
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, ""))
  .transform((v) => (/^\d{10}$/.test(v) ? `+91${v}` : v))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "v.phone"));

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1, "v.passwordRequired"),
});

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "v.name").max(80, "v.nameLong"),
    phone: phoneSchema,
    password: z.string().min(8, "v.passwordShort").max(128, "v.passwordLong"),
    email: z.string().trim().toLowerCase().email("v.email").optional().or(z.literal("")),
    notifyChannels: z.array(z.enum(NOTIFY_CHANNELS)).min(1, "v.channels"),
  })
  .refine((v) => !v.notifyChannels.includes("EMAIL") || !!v.email, {
    message: "v.emailNeeded",
    path: ["email"],
  });

// Mongo ObjectId in a URL or body; rejecting bad ids here gives 400 instead of a 500 CastError
export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, "v.id");

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "v.date");

export const bookSchema = z.object({
  serviceId: objectIdSchema,
  date: dateSchema,
});

export const tokenActionSchema = z.object({ action: z.literal("cancel") });

export const tokenListQuery = z.object({
  status: z.enum(["active", "past"]).default("active"),
});

export type LoginInput = z.input<typeof loginSchema>;
export type SignupInput = z.input<typeof signupSchema>;
export type BookInput = z.infer<typeof bookSchema>;
export type TokenListQuery = z.infer<typeof tokenListQuery>;
