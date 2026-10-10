import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import mongoose from "mongoose";
import { dbConnect } from "../lib/db";
import { Department, Service, Employee } from "../lib/models";

async function runPhase2Tests() {
  console.log("🧪 Starting Phase 2 (Department Management) Test Suite...\n");

  await dbConnect();

  let createdDeptId: string | null = null;
  let testPassed = 0;
  let testFailed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      testPassed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      testFailed++;
    }
  }

  try {
    // Test 1: Query existing departments from seed
    console.log("👉 Test 1: Fetch existing seeded department");
    const existing = await Department.findOne({ code: "RTO-AHM" });
    assert(existing !== null, "Seeded department RTO-AHM found");
    assert(existing?.workingHours?.start === "09:00", "Working hours start is 09:00");
    assert(existing?.workingHours?.end === "17:00", "Working hours end is 17:00");
    assert(Array.isArray(existing?.holidays) && existing.holidays.length >= 3, "Holidays list is populated");

    // Test 2: Create a new Department
    console.log("\n👉 Test 2: Create a new Department with custom working hours & week-offs");
    const testCode = "TEST-DEPT-" + Date.now().toString().slice(-4);
    const newDept = await Department.create({
      name: "Test Sub-Division",
      code: testCode,
      address: "123 Governance Way",
      city: "Gandhinagar",
      workingHours: {
        start: "08:30",
        end: "16:30",
      },
      weekOffDays: [0, 6], // Sun, Sat
      holidays: [
        { date: "2026-11-01", name: "State Foundation Day" },
      ],
      timezone: "Asia/Kolkata",
      isActive: true,
    });

    createdDeptId = newDept._id.toString();
    assert(newDept._id !== undefined, `Created department with ID: ${createdDeptId}`);
    assert(newDept.code === testCode, `Department code matches: ${testCode}`);
    assert(newDept.weekOffDays.length === 2, "Week off days configured properly");

    // Test 3: Uniqueness check on code
    console.log("\n👉 Test 3: Duplicate code rejection");
    let duplicateRejected = false;
    try {
      await Department.create({
        name: "Duplicate Dept",
        code: testCode,
        workingHours: { start: "09:00", end: "17:00" },
        timezone: "Asia/Kolkata",
      });
    } catch (err: any) {
      duplicateRejected = true;
    }
    assert(duplicateRejected, "Duplicate department code was properly rejected by database");

    // Test 4: Update Department details & Holidays
    console.log("\n👉 Test 4: Update working hours & append holiday");
    const fetched = await Department.findById(createdDeptId);
    assert(fetched !== null, "Found newly created department");

    if (fetched) {
      fetched.workingHours = { start: "10:00", end: "18:00" };
      fetched.holidays.push({ date: "2026-12-31", name: "Year End Special Holiday" });
      await fetched.save();

      const updated = await Department.findById(createdDeptId);
      assert(updated?.workingHours.start === "10:00", "Working start updated to 10:00");
      assert(updated?.workingHours.end === "18:00", "Working end updated to 18:00");
      assert(updated?.holidays.length === 2, "Holiday list now has 2 entries");
    }

    // Test 5: Soft delete / Deactivate
    console.log("\n👉 Test 5: Deactivate department");
    if (fetched) {
      fetched.isActive = false;
      await fetched.save();
      const deactivated = await Department.findById(createdDeptId);
      assert(deactivated?.isActive === false, "Department successfully deactivated (isActive: false)");
    }

    // Cleanup test department
    if (createdDeptId) {
      await Department.findByIdAndDelete(createdDeptId);
      console.log(`\n🧹 Cleaned up test department (${createdDeptId})`);
    }

    console.log(`\n========================================`);
    console.log(`Phase 2 Test Results: ${testPassed} Passed, ${testFailed} Failed`);
    console.log(`========================================\n`);

    if (testFailed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error("❌ Unexpected test execution failure:", error);
    if (createdDeptId) {
      await Department.findByIdAndDelete(createdDeptId).catch(() => {});
    }
    process.exit(1);
  }
}

runPhase2Tests();
