// Shared: identical in backoffice lib/ and frontdesk src/lib/. Change both copies.
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICitizen extends Document {
  name: string;
  phone: string;
  passwordHash: string;
  email?: string;
  notifyChannels: ("EMAIL" | "SMS" | "WHATSAPP")[];
  phoneVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CitizenSchema = new Schema<ICitizen>(
  {
    name:           { type: String, required: true },
    phone:          { type: String, required: true, unique: true },
    passwordHash:   { type: String, required: true, select: false }, // read with .select("+passwordHash")
    email:          { type: String },
    notifyChannels: { type: [String], enum: ["EMAIL", "SMS", "WHATSAPP"], default: ["SMS"] },
    phoneVerified:  { type: Boolean, default: false },
  },
  { timestamps: true, collection: "citizen" }
);

export const Citizen: Model<ICitizen> =
  mongoose.models.Citizen || mongoose.model("Citizen", CitizenSchema);
