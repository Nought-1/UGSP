// Dev only: books test tokens for today through the real booking path (reserveSlot in lib/queue-core.ts),
// so the queue console and the notifier can be tried before frontdesk booking exists. Nothing is deleted.
//
//   npm run db:seed:tokens -- --service DL                        5 tokens, each in the first window with seats
//   npm run db:seed:tokens -- --service DL --count 8 --department RTO-AHM --window 14:30
//
// Windows that have already started today can't be booked (as for citizens), so run it before the last one.
// Test citizens are +910000000001, +910000000002, ... (created on first use, reused after). A citizen holds one
// live token per queue, so a second run books only for citizens who don't have one yet.
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import bcrypt from "bcryptjs";
import { dbConnect } from "../lib/db";
import { Citizen, CitizenToken, Department, Service, ServiceQueue } from "../lib/models";
import { LIVE_STATUSES, releaseSlot, reserveSlot, todayIn, tokenEta, windowsFor } from "../lib/queue-core";

async function seedTokens() {
  if (process.env.NODE_ENV === "production") throw new Error("seed-tokens is for development only.");

  const { values } = parseArgs({
    options: {
      service: { type: "string" },
      department: { type: "string" },
      count: { type: "string", default: "5" },
      window: { type: "string" },
    },
  });
  const code = values.service?.trim().toUpperCase();
  const count = Number(values.count);
  if (!code || !Number.isInteger(count) || count < 1 || count > 50) {
    throw new Error("Usage: npm run db:seed:tokens -- --service <CODE> [--department <CODE>] [--count 1-50]");
  }

  await dbConnect();
  const departmentCode = values.department?.trim().toUpperCase();
  const department = departmentCode ? await Department.findOne({ code: departmentCode }).lean() : null;
  if (departmentCode && !department) throw new Error(`No department with code ${departmentCode}.`);

  const services = await Service.find(department ? { code, departmentId: department._id } : { code }).lean();
  if (services.length !== 1) {
    throw new Error(services.length ? `${services.length} services use ${code}; add --department.` : `No service ${code}.`);
  }
  const service = services[0];
  const dept = department ?? (await Department.findById(service.departmentId).lean());
  if (!dept) throw new Error("The service's department is missing.");

  const now = new Date();
  const today = todayIn(dept.timezone, now);
  const passwordHash = await bcrypt.hash(randomBytes(16).toString("base64url"), 10); // test citizens can't sign in
  const timeOf = (at: Date) =>
    at.toLocaleTimeString("en-IN", { timeZone: dept.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const rows: Record<string, string>[] = [];
  for (let n = 1; n <= count; n++) {
    const phone = `+91${String(n).padStart(10, "0")}`;
    const citizen = await Citizen.findOneAndUpdate(
      { phone },
      { $setOnInsert: { name: `Test Citizen ${n}`, phone, passwordHash } },
      { upsert: true, returnDocument: "after" }
    ).lean();
    if (!citizen) throw new Error(`Could not create ${phone}.`);

    const queue = await ServiceQueue.findOne({ serviceId: service._id, date: today }).select("_id").lean();
    if (
      queue &&
      (await CitizenToken.exists({ citizenId: citizen._id, queueId: queue._id, status: { $in: LIVE_STATUSES } }))
    ) {
      rows.push({ phone, result: "already holds a live token" });
      continue;
    }

    // Same steps as frontdesk booking (_notes/frontdesk-handoff.md §7): pick a window, reserve, ETA, insert
    const window = values.window ?? (await windowsFor(service._id, today, now)).windows.find((w) => w.remaining > 0)?.start;
    const slot = window ? await reserveSlot(service._id, today, window, now) : null;
    if (!slot) {
      rows.push({ phone, result: `no seat (${today} ${window ?? ""}: full, started, closed or unstaffed)` });
      break;
    }
    try {
      const { eta } = await tokenEta(slot.queueId, { tokenNumber: slot.tokenNumber, status: "WAITING", slotStart: slot.slotStart }, now);
      await CitizenToken.create({
        citizenId: citizen._id,
        queueId: slot.queueId,
        serviceId: service._id,
        date: today,
        slotStart: slot.slotStart,
        tokenNumber: slot.tokenNumber,
        estimatedServeAt: eta,
        bookedServeAt: eta,
      });
      rows.push({ phone, token: `${service.code}-${String(slot.tokenNumber).padStart(3, "0")}`, window: slot.slotStart, eta: timeOf(eta), result: "booked" });
    } catch (error) {
      await releaseSlot(slot.queueId, slot.slotStart); // give the seat back
      throw error;
    }
  }

  console.log(`${service.name} (${service.code}), ${dept.name}, ${today}`);
  console.table(rows);
}

seedTokens().then(
  () => process.exit(0),
  (err) => {
    console.error("Token seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
