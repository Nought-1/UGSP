import { z } from "zod";

// Shared by the forms (react-hook-form + zodResolver) and the server (API routes, NextAuth authorize).

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
// bcrypt reads only the first 72 bytes
const password = z.string().min(8, "Use at least 8 characters").max(72, "Use at most 72 characters");
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{2,12}$/, "2 to 12 letters, digits or dashes");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});
export type SignInValues = z.infer<typeof signInSchema>;

// First-run setup: the first department and its ADMIN
export const setupSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your full name"),
    email,
    password,
    confirmPassword: z.string(),
    departmentName: z.string().trim().min(2, "Enter the department name"),
    departmentCode: code,
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SetupValues = z.infer<typeof setupSchema>;

// ---- Departments ----

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Intl.supportedValuesOf("timeZone") lacks aliases such as Asia/Kolkata and UTC, so ask the formatter directly
export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

const time = z.string().regex(HHMM, "Use 24-hour time, e.g. 09:00");
export const ymd = z.string().regex(YMD, "Use a YYYY-MM-DD date");

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Enter the department name").max(100),
  code,
  address: z.string().trim().max(200),
  city: z.string().trim().max(80),
  workingHours: z
    .object({ start: time, end: time })
    .refine((hours) => hours.start < hours.end, { message: "Closing time must be after opening time", path: ["end"] }),
  weekOffDays: z
    .array(z.number().int().min(0).max(6))
    .max(6, "Keep at least one working day")
    .refine((days) => new Set(days).size === days.length, "Each day can only be picked once"),
  timezone: z.string().refine(isValidTimeZone, "Unknown time zone"),
  holidays: z
    .array(
      z.object({
        date: ymd,
        name: z.string().trim().min(1, "Name the holiday").max(80),
      })
    )
    .refine((list) => new Set(list.map((h) => h.date)).size === list.length, "Two holidays share a date"),
  isActive: z.boolean(),
});
export type DepartmentValues = z.infer<typeof departmentSchema>;

// PATCH takes any subset: the holiday manager saves only holidays, the switch only isActive
export const departmentPatchSchema = departmentSchema.partial();

// ---- Services ----

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Pick a valid item");
const objectIds = z.array(objectId).refine((ids) => new Set(ids).size === ids.length, "Each item can only be picked once");
const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number({ error: `Enter ${label}` })
    .int(`${label} must be a whole number`)
    .min(min, `${label}: ${min} to ${max}`)
    .max(max, `${label}: ${min} to ${max}`);

export const serviceSchema = z.object({
  departmentId: objectId,
  name: z.string().trim().min(2, "Enter the service name").max(100),
  code,
  description: z.string().trim().max(300),
  avgServiceMinutes: wholeNumber("Average minutes", 1, 240),
  cutoffTime: time,
  dailyTokenLimit: wholeNumber("Daily limit", 1, 1000),
  bookingWindowDays: wholeNumber("Booking window", 1, 60),
  alertLeadMinutes: wholeNumber("Alert lead time", 0, 240),
  isActive: z.boolean(),
  officerIds: objectIds, // OFFICERs of the department who serve it (stored on Employee.serviceIds)
});
export type ServiceValues = z.infer<typeof serviceSchema>;

// A service stays in its department: its queues and officers belong there
export const servicePatchSchema = serviceSchema.omit({ departmentId: true }).partial();

// ---- Staff ----

const employeeFields = {
  name: z.string().trim().min(2, "Enter the full name").max(100),
  email,
  role: z.enum(["ADMIN", "OFFICER"]),
  departmentId: objectId,
  serviceIds: objectIds,
  counterNumber: wholeNumber("Counter", 1, 99).nullable(), // null: no counter
  isActive: z.boolean(),
};

// The admin types the first password
export const employeeSchema = z.object({ ...employeeFields, password });
export type EmployeeValues = z.infer<typeof employeeSchema>;

export const employeePatchSchema = z.object(employeeFields).partial();

const mismatch = { message: "Passwords do not match", path: ["confirmPassword"] };

// Admin resets someone's password
export const passwordResetSchema = z
  .object({ password, confirmPassword: z.string() })
  .refine((values) => values.password === values.confirmPassword, mismatch);
export type PasswordResetValues = z.infer<typeof passwordResetSchema>;

// Staff change their own password
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, mismatch);
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

// ---- Leave ----

const leaveFields = { from: ymd, to: ymd, reason: z.string().trim().max(120) };
const endsAfterStart = (leave: { from: string; to: string }) => leave.from <= leave.to;
const leaveOrder = { message: "Leave must end on or after its first day", path: ["to"] };

export const leaveSchema = z.object(leaveFields).refine(endsAfterStart, leaveOrder);
export type LeaveValues = z.infer<typeof leaveSchema>;

// The add-leave dialog also picks the staff member (the API takes them from the URL)
export const leaveFormSchema = z
  .object({ employeeId: z.string().min(1, "Pick a staff member"), ...leaveFields })
  .refine(endsAfterStart, leaveOrder);
export type LeaveFormValues = z.infer<typeof leaveFormSchema>;

// ---- Queue console (OFFICER) ----

export const queueActionSchema = z.object({ action: z.enum(["pause", "open", "close"]) });
export const tokenActionSchema = z.object({
  action: z.enum(["arrive", "complete", "no_show", "cancel", "come_early"]),
});
// An officer stepping away from the counter: no citizens are auto-assigned to them
export const awaySchema = z.object({ away: z.boolean() });

// Codes thrown by NextAuth authorize() (lib/auth.ts), shown on the sign-in page
export const SIGN_IN_ERRORS: Record<string, string> = {
  INVALID_CREDENTIALS: "Incorrect email or password.",
  CredentialsSignin: "Incorrect email or password.",
  INACTIVE_ACCOUNT: "This account is deactivated. Contact your administrator.",
  SERVICE_UNAVAILABLE: "Sign-in is unavailable right now. Try again in a minute.",
};
