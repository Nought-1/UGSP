// Seeds the team's ADMIN accounts. Safe to re-run: existing emails are skipped; nothing is deleted or overwritten.
//
//   npm run db:seed:admins                          random password per admin, printed once
//   SEED_ADMIN_PASSWORD=... npm run db:seed:admins  same password for every new admin (min 8 characters)
//   npm run db:seed:admins -- --dry-run             show what would happen, write nothing
//
// ADMINs manage every department, but the model needs one: SEED_DEPARTMENT_CODE, else the oldest active department.
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { dbConnect } from "../lib/db";
import { Department, Employee } from "../lib/models";

const ADMINS = [
  { name: "Harsh", email: "harsh@rto.gov.in" },
  { name: "Diya", email: "diya@rto.gov.in" },
  { name: "Darvin", email: "darvin@rto.gov.in" },
];

async function seedAdmins() {
  const dryRun = process.argv.includes("--dry-run");
  const sharedPassword = process.env.SEED_ADMIN_PASSWORD;
  if (sharedPassword !== undefined && sharedPassword.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 8 characters.");
  }

  await dbConnect();

  const code = process.env.SEED_DEPARTMENT_CODE?.trim().toUpperCase();
  const department = await Department.findOne(code ? { code } : { isActive: true }).sort({ createdAt: 1 });
  if (!department) {
    throw new Error(
      code
        ? `No department with code ${code}.`
        : "No active department yet. Run first-time setup (/sign-up) or npm run db:seed first."
    );
  }

  const rows: { name: string; email: string; result: string; password: string }[] = [];
  for (const admin of ADMINS) {
    const existing = await Employee.findOne({ email: admin.email }).select("role");
    if (existing) {
      rows.push({ ...admin, result: `already exists (${existing.role}), unchanged`, password: "" });
      continue;
    }

    const password = sharedPassword ?? randomBytes(9).toString("base64url"); // 12 characters
    if (!dryRun) {
      await Employee.create({
        departmentId: department._id,
        name: admin.name,
        email: admin.email,
        passwordHash: await bcrypt.hash(password, 10),
        role: "ADMIN",
        serviceIds: [],
        leaves: [],
        isActive: true,
      });
    }
    rows.push({
      ...admin,
      result: dryRun ? "would be created" : "created",
      password: dryRun ? "" : sharedPassword ? "(SEED_ADMIN_PASSWORD)" : password,
    });
  }

  console.log(`Department: ${department.name} (${department.code})${dryRun ? "   [dry run: nothing written]" : ""}`);
  console.table(rows);
  if (!dryRun && !sharedPassword && rows.some((row) => row.result === "created")) {
    console.log("Generated passwords are shown only once. Share them privately.");
  }
}

seedAdmins().then(
  () => process.exit(0),
  (err) => {
    console.error("Admin seed failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
