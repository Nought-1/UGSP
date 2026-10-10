// Shared: identical in backoffice lib/ and frontdesk src/lib/. Change both copies.
import mongoose, { Schema, Document, Model } from "mongoose";

// --- Subdocument schemas ---
const WorkingHoursSchema = new Schema(
  { start: { type: String, required: true },   // "09:00"
    end:   { type: String, required: true } },  // "17:00"
  { _id: false }
);

const HolidaySchema = new Schema(
  { date: { type: String, required: true },     // "YYYY-MM-DD"
    name: { type: String, required: true } },
  { _id: false }
);

// --- Main schema ---
export interface IDepartment extends Document {
  name: string;
  code: string;
  address?: string;
  city?: string;
  workingHours: { start: string; end: string };
  weekOffDays: number[];
  holidays: { date: string; name: string }[];
  timezone: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name:         { type: String, required: true },
    code:         { type: String, required: true, unique: true },
    address:      { type: String },
    city:         { type: String },
    workingHours: { type: WorkingHoursSchema, required: true },
    weekOffDays:  { type: [Number], default: [0, 6] },   // 0=Sun, 6=Sat
    holidays:     { type: [HolidaySchema], default: [] },
    timezone:     { type: String, required: true },       // "Asia/Kolkata"
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true, collection: "department" }
);

export const Department: Model<IDepartment> =
  mongoose.models.Department || mongoose.model("Department", DepartmentSchema);
