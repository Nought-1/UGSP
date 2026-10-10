// Shared: identical in backoffice lib/ and frontdesk src/lib/. Change both copies.
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IServiceQueue extends Document {
  serviceId: Types.ObjectId;
  departmentId: Types.ObjectId;
  date: string;                     // "YYYY-MM-DD"
  status: "OPEN" | "PAUSED" | "CLOSED";
  activeEmployees: number;
  capacity: number;
  issuedCount: number;
  lastTokenNumber: number;
  nowServing: number;
  completedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceQueueSchema = new Schema<IServiceQueue>(
  {
    serviceId:       { type: Schema.Types.ObjectId, ref: "Service", required: true },
    departmentId:    { type: Schema.Types.ObjectId, ref: "Department", required: true },
    date:            { type: String, required: true },
    status:          { type: String, enum: ["OPEN", "PAUSED", "CLOSED"], default: "OPEN" },
    activeEmployees: { type: Number, required: true },
    capacity:        { type: Number, required: true },
    issuedCount:     { type: Number, default: 0 },
    lastTokenNumber: { type: Number, default: 0 },
    nowServing:      { type: Number, default: 0 },
    completedCount:  { type: Number, default: 0 },
  },
  { timestamps: true, collection: "service_queue" }
);

// One queue per service per date
ServiceQueueSchema.index({ serviceId: 1, date: 1 }, { unique: true });
ServiceQueueSchema.index({ departmentId: 1, date: 1 });

export const ServiceQueue: Model<IServiceQueue> =
  mongoose.models.ServiceQueue || mongoose.model("ServiceQueue", ServiceQueueSchema);
