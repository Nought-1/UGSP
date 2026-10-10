// Shared: identical in backoffice lib/ and frontdesk src/lib/. Change both copies.
import mongoose, { Schema, Document, Model, Types } from "mongoose";

const NotificationSchema = new Schema(
  {
    event:   { type: String, enum: ["BOOKED", "ARRIVE_SOON", "CANCELLED"], required: true },
    channel: { type: String, enum: ["EMAIL", "SMS", "WHATSAPP"], required: true },
    status:  { type: String, enum: ["SENT", "FAILED"], required: true },
    sentAt:  { type: Date, required: true },
    error:   { type: String },
  },
  { _id: false }
);

export interface ICitizenToken extends Document {
  citizenId: Types.ObjectId;
  queueId: Types.ObjectId;
  serviceId: Types.ObjectId;
  servedById?: Types.ObjectId;
  counterNumber?: number; // copied from the officer when the token is called
  date: string;
  tokenNumber: number;
  status: "WAITING" | "ARRIVED" | "IN_SERVICE" | "COMPLETED" | "NO_SHOW" | "CANCELLED";
  estimatedServeAt: Date;
  bookedServeAt: Date;
  notifiedAt?: Date;
  notifications: {
    event: string; channel: string; status: string; sentAt: Date; error?: string;
  }[];
  arrivedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CitizenTokenSchema = new Schema<ICitizenToken>(
  {
    citizenId:        { type: Schema.Types.ObjectId, ref: "Citizen", required: true },
    queueId:          { type: Schema.Types.ObjectId, ref: "ServiceQueue", required: true },
    serviceId:        { type: Schema.Types.ObjectId, ref: "Service", required: true },
    servedById:       { type: Schema.Types.ObjectId, ref: "Employee" },
    counterNumber:    { type: Number },
    date:             { type: String, required: true },
    tokenNumber:      { type: Number, required: true },
    status:           { type: String, enum: ["WAITING", "ARRIVED", "IN_SERVICE", "COMPLETED", "NO_SHOW", "CANCELLED"], default: "WAITING" },
    estimatedServeAt: { type: Date, required: true },
    bookedServeAt:    { type: Date, required: true }, // ETA promised at booking, never refreshed (ETA-accuracy metric)
    notifiedAt:       { type: Date },
    notifications:    { type: [NotificationSchema], default: [] },
    arrivedAt:        { type: Date },
    startedAt:        { type: Date },
    completedAt:      { type: Date },
  },
  { timestamps: true, collection: "citizen_token" }
);

// Unique token number within a queue
CitizenTokenSchema.index({ queueId: 1, tokenNumber: 1 }, { unique: true });
// "Next to call" and "people ahead" queries
CitizenTokenSchema.index({ queueId: 1, status: 1, tokenNumber: 1 });
// "My tokens" lookup
CitizenTokenSchema.index({ citizenId: 1, date: 1 });
// One live token per citizen per service per day
CitizenTokenSchema.index(
  { citizenId: 1, queueId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["WAITING", "ARRIVED", "IN_SERVICE"] } } }
);
// An officer serves one token at a time; a second "call next" fails with E11000 (double-click safe)
CitizenTokenSchema.index(
  { servedById: 1, date: 1 },
  { unique: true, partialFilterExpression: { status: "IN_SERVICE" } }
);
// Notifier scans by day and status
CitizenTokenSchema.index({ date: 1, status: 1 });

export const CitizenToken: Model<ICitizenToken> =
  mongoose.models.CitizenToken || mongoose.model("CitizenToken", CitizenTokenSchema);
