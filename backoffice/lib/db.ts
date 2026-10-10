// Shared: identical in backoffice lib/ and frontdesk src/lib/. Change both copies.
import mongoose from "mongoose";
import dns from "node:dns";

// Ensure DNS resolution succeeds for mongodb+srv on Windows/custom network resolvers
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore if not permitted
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.mongooseCache ?? { conn: null, promise: null };

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached;
}

export async function dbConnect() {
  const MONGODB_URI = process.env.DATABASE_URL;

  if (!MONGODB_URI) {
    throw new Error("Please define DATABASE_URL in .env or .env.local");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // let the next request retry instead of reusing a failed connect
    throw err;
  }
  return cached.conn;
}
