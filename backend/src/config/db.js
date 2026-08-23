// Shared foundation — build together as a team before individual module work.
// Purpose: connect to MongoDB using DATABASE_URL from .env

import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDB = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);

    console.log("✓ MongoDB connected successfully");
  } catch (error) {
    console.error("✗ MongoDB connection failed:", error.message);
    throw error;
  }
};