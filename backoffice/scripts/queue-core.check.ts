// Self-check for the pure rules in lib/queue-core.ts and lib/impact.ts (no database). Run: npm run check:queue-core
import assert from "node:assert/strict";
import {
  addDays,
  bookingCap,
  closedReason,
  countActive,
  dayCapacity,
  estimateServeAt,
  etasFor,
  minutesOfDayIn,
  todayIn,
  weekdayOf,
  zonedTimeToDate,
} from "../lib/queue-core";
import { impactOf } from "../lib/impact";

const IST = "Asia/Kolkata"; // UTC+05:30, no DST
const dept = {
  workingHours: { start: "09:00", end: "17:00" },
  weekOffDays: [0, 6],
  holidays: [{ date: "2026-10-02", name: "Gandhi Jayanti" }],
  timezone: IST,
  isActive: true,
};
const service = { avgServiceMinutes: 10, cutoffTime: "16:00", dailyTokenLimit: 50, bookingWindowDays: 7 };
const at = (iso: string) => new Date(iso);

// Dates and times in a zone
assert.equal(todayIn(IST, at("2026-10-10T20:00:00Z")), "2026-10-11"); // 01:30 IST next day
assert.equal(todayIn("UTC", at("2026-10-10T20:00:00Z")), "2026-10-10");
assert.equal(minutesOfDayIn(IST, at("2026-10-10T03:30:00Z")), 9 * 60);
assert.equal(addDays("2026-12-31", 1), "2027-01-01");
assert.equal(addDays("2028-02-28", 1), "2028-02-29");
assert.equal(weekdayOf("2026-10-10"), 6); // Saturday
assert.equal(zonedTimeToDate("2026-10-12", "09:00", IST).toISOString(), "2026-10-12T03:30:00.000Z");
assert.equal(zonedTimeToDate("2026-10-12", "09:00", "UTC").toISOString(), "2026-10-12T09:00:00.000Z");
// London: GMT in January, BST (+1) after the 29 Mar 2026 switch
assert.equal(zonedTimeToDate("2026-01-15", "09:00", "Europe/London").toISOString(), "2026-01-15T09:00:00.000Z");
assert.equal(zonedTimeToDate("2026-03-30", "09:00", "Europe/London").toISOString(), "2026-03-30T08:00:00.000Z");

// Working days
assert.equal(closedReason(dept, "2026-10-10"), "WEEK_OFF");
assert.equal(closedReason(dept, "2026-10-02"), "HOLIDAY");
assert.equal(closedReason(dept, "2026-10-12"), null);
assert.equal(closedReason({ ...dept, isActive: false }, "2026-10-12"), "DEPT_INACTIVE");

// Active officers: OFFICER role only, active, not on leave (inclusive range)
const officers = [
  { isActive: true, role: "OFFICER", leaves: [{ from: "2026-10-12", to: "2026-10-14" }] },
  { isActive: true, role: "OFFICER", leaves: [] },
  { isActive: false, role: "OFFICER", leaves: [] },
  { isActive: true, role: "ADMIN", leaves: [] },
];
assert.equal(countActive(officers, "2026-10-14"), 1);
assert.equal(countActive(officers, "2026-10-15"), 2);

// Whole-day capacity: min(limit, floor(officers × minutes to the cutoff / avg)); cutoff capped at closing
assert.equal(dayCapacity(dept, service, 2), 50); // 2 × 420 / 10 = 84, limit 50
assert.equal(dayCapacity(dept, { ...service, dailyTokenLimit: 100 }, 2), 84);
assert.equal(dayCapacity(dept, { ...service, dailyTokenLimit: 100, cutoffTime: "18:00" }, 2), 96); // closes 17:00
assert.equal(dayCapacity(dept, service, 0), 0);

// Booking cap: past 0, future whole day, today = finished + what still fits before the cutoff
const day = "2026-10-12";
const tenAm = at("2026-10-12T04:30:00Z"); // 10:00 IST
assert.equal(bookingCap(dept, service, "2026-10-09", 2, 0, tenAm), 0);
assert.equal(bookingCap(dept, service, "2026-10-13", 2, 0, tenAm), 50);
assert.equal(bookingCap(dept, service, day, 2, 30, at("2026-10-12T09:30:00Z")), 42); // 15:00 IST: 30 + 2 × 60 / 10
assert.equal(bookingCap(dept, service, day, 2, 0, at("2026-10-12T02:30:00Z")), 50); // 08:00 IST: whole day still ahead
assert.equal(bookingCap(dept, service, day, 2, 35, at("2026-10-12T11:00:00Z")), 35); // 16:30 IST: past the cutoff

// ETA: max(now, opening) + floor(peopleAhead / officers) × avg (officers work in parallel)
assert.equal(estimateServeAt(dept, service, "2026-10-13", 2, 3, tenAm).toISOString(), "2026-10-13T03:40:00.000Z"); // 09:10 IST
assert.equal(estimateServeAt(dept, service, day, 2, 0, tenAm).toISOString(), tenAm.toISOString());
assert.equal(estimateServeAt(dept, service, day, 0, 1, tenAm).toISOString(), "2026-10-12T04:40:00.000Z"); // no staff counts as 1
// 2 officers: tokens 5 and 7 are served together at 10:00, token 9 one service time later
const etas = etasFor([5, 7, 9], dept, service, day, 2, tenAm);
assert.deepEqual(
  [...etas.values()].map((d) => d.toISOString()),
  ["2026-10-12T04:30:00.000Z", "2026-10-12T04:30:00.000Z", "2026-10-12T04:40:00.000Z"]
);

// Impact: minutes saved count from the later of opening and booking until arrival; ETA error is startedAt - bookedServeAt
const ist = (hm: string) => at(`2026-10-12T${hm}:00+05:30`);
const impact = impactOf([
  // booked the evening before, arrived 10:00 (60 min after opening), called 10:10, promised 10:05
  { openAt: ist("09:00"), createdAt: at("2026-10-11T14:00:00Z"), arrivedAt: ist("10:00"), startedAt: ist("10:10"), bookedServeAt: ist("10:05") },
  // booked 11:00 on the day, arrived 11:30, called 11:40, promised 12:20 (served 40 min early)
  { openAt: ist("09:00"), createdAt: ist("11:00"), arrivedAt: ist("11:30"), startedAt: ist("11:40"), bookedServeAt: ist("12:20") },
  // never marked arrived: counts for ETA accuracy only; promised 12:00, called 12:10
  { openAt: ist("09:00"), createdAt: ist("08:00"), arrivedAt: null, startedAt: ist("12:10"), bookedServeAt: ist("12:00") },
]);
assert.deepEqual(impact, {
  served: 3,
  citizenMinutesSaved: 90, // 60 + 30
  avgInOfficeWaitMinutes: 10,
  etaAccuracy: { meanErrorMinutes: 18, medianErrorMinutes: 10, within15Pct: 67, biasMinutes: -8 }, // |5|, |-40|, |10|
});
assert.deepEqual(impactOf([]), { served: 0, citizenMinutesSaved: 0, avgInOfficeWaitMinutes: null, etaAccuracy: null });

console.log("queue-core: all checks passed");
