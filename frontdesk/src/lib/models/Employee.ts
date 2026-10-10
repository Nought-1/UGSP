// Shared: identical in backoffice lib/ and frontdesk src/lib/. Change both copies.
import mongoose, { Schema, Document, Model, Types } from "mongoose";

const LeaveSchema = new Schema(
  { from:   { type: String, required: true },   // "YYYY-MM-DD"
    to:     { type: String, required: true },   // "YYYY-MM-DD"
    reason: { type: String } },
  { _id: false }
);

export interface ILeave {
  from: string;
  to: string;
  reason?: string;
}

export interface IEmployee extends Document {
  departmentId: Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  role: "ADMIN" | "OFFICER";
  serviceIds: Types.ObjectId[];
  leaves: ILeave[];
  counterNumber?: number; // desk shown to citizens when this officer calls a token
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    name:         { type: String, required: true },
    email:        { type: String, required: true, unique: true },
    passwordHash: { type: String, select: false }, // read with .select("+passwordHash")
    role:         { type: String, enum: ["ADMIN", "OFFICER"], default: "OFFICER" },
    serviceIds:   [{ type: Schema.Types.ObjectId, ref: "Service" }],
    leaves:       { type: [LeaveSchema], default: [] },
    counterNumber: { type: Number, min: 1, max: 99 },
    isActive:     { type: Boolean, default: true },
  },
  { timestamps: true, collection: "employees" }
);

// "Who can process this service"; the departmentId prefix also serves department lookups
EmployeeSchema.index({ departmentId: 1, serviceIds: 1 });

export const Employee: Model<IEmployee> =
  mongoose.models.Employee || mongoose.model("Employee", EmployeeSchema);
