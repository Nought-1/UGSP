// Shared: identical in backoffice lib/ and frontdesk src/lib/. Change both copies.
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IService extends Document {
  departmentId: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  avgServiceMinutes: number;
  cutoffTime: string;               // "HH:mm"
  dailyTokenLimit: number;
  bookingWindowDays: number;
  alertLeadMinutes: number; // ARRIVE_SOON goes out this long before the estimated turn
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    departmentId:      { type: Schema.Types.ObjectId, ref: "Department", required: true },
    name:              { type: String, required: true },
    code:              { type: String, required: true },
    description:       { type: String },
    avgServiceMinutes: { type: Number, required: true, min: 1 },
    cutoffTime:        { type: String, required: true },
    dailyTokenLimit:   { type: Number, required: true, min: 1 },
    bookingWindowDays: { type: Number, default: 7, min: 1 },
    alertLeadMinutes:  { type: Number, default: 30, min: 0, max: 240 },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true, collection: "services" }
);

// Unique code within a department
ServiceSchema.index({ departmentId: 1, code: 1 }, { unique: true });

export const Service: Model<IService> =
  mongoose.models.Service || mongoose.model("Service", ServiceSchema);
