import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { dbConnect } from "../lib/db";
import { Department, Service, Employee } from "../lib/models";

async function seed() {
  console.log("🌱 Starting seed...");
  await dbConnect();

  // Clean existing collections
  await Promise.all([
    Department.deleteMany({}),
    Service.deleteMany({}),
    Employee.deleteMany({}),
  ]);
  console.log("🧹 Cleared existing Department, Service, and Employee records.");

  // 1. Create Department
  const department = await Department.create({
    name: "RTO Ahmedabad",
    code: "RTO-AHM",
    address: "Subhash Bridge, Ashram Road",
    city: "Ahmedabad",
    workingHours: {
      start: "09:00",
      end: "17:00",
    },
    weekOffDays: [0, 6], // Sunday & Saturday
    holidays: [
      { date: "2026-01-26", name: "Republic Day" },
      { date: "2026-08-15", name: "Independence Day" },
      { date: "2026-10-02", name: "Gandhi Jayanti" },
    ],
    timezone: "Asia/Kolkata",
    isActive: true,
  });
  console.log(`✅ Created Department: ${department.name} (${department.code})`);

  // 2. Create Services
  const [llService, dlService, vtService] = await Promise.all([
    Service.create({
      departmentId: department._id,
      name: "Learning License",
      code: "LL",
      description: "Application and test for new learning license",
      avgServiceMinutes: 10,
      cutoffTime: "16:00",
      dailyTokenLimit: 50,
      bookingWindowDays: 7,
      isActive: true,
    }),
    Service.create({
      departmentId: department._id,
      name: "Driving License",
      code: "DL",
      description: "Driving skill test and permanent license issue",
      avgServiceMinutes: 15,
      cutoffTime: "15:30",
      dailyTokenLimit: 30,
      bookingWindowDays: 7,
      isActive: true,
    }),
    Service.create({
      departmentId: department._id,
      name: "Vehicle Transfer",
      code: "VT",
      description: "Ownership transfer and RC endorsement",
      avgServiceMinutes: 20,
      cutoffTime: "16:00",
      dailyTokenLimit: 20,
      bookingWindowDays: 5,
      isActive: true,
    }),
  ]);
  console.log("✅ Created 3 Services: Learning License, Driving License, Vehicle Transfer");

  // 3. Create Employees with hashed passwords
  const adminHash = await bcrypt.hash("admin123", 10);
  const officerHash = await bcrypt.hash("officer123", 10);

  await Promise.all([
    Employee.create({
      departmentId: department._id,
      name: "Admin User",
      email: "admin@rto.gov.in",
      passwordHash: adminHash,
      role: "ADMIN",
      serviceIds: [llService._id, dlService._id, vtService._id],
      leaves: [],
      isActive: true,
    }),
    Employee.create({
      departmentId: department._id,
      name: "Officer Ramesh",
      email: "officer1@rto.gov.in",
      passwordHash: officerHash,
      role: "OFFICER",
      serviceIds: [llService._id, dlService._id],
      leaves: [],
      isActive: true,
    }),
    Employee.create({
      departmentId: department._id,
      name: "Officer Priya",
      email: "officer2@rto.gov.in",
      passwordHash: officerHash,
      role: "OFFICER",
      serviceIds: [dlService._id, vtService._id],
      leaves: [],
      isActive: true,
    }),
  ]);

  console.log("✅ Created 3 Employees:");
  console.log("   - Admin:   admin@rto.gov.in   / admin123   (ADMIN)");
  console.log("   - Officer: officer1@rto.gov.in / officer123 (OFFICER)");
  console.log("   - Officer: officer2@rto.gov.in / officer123 (OFFICER)");

  console.log("\n🎉 Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
