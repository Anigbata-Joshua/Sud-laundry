// Shared foundation — build together as a team before individual module work.
// Purpose: connect to MongoDB using DATABASE_URL from .env

import mongoose from 'mongoose';
import { env } from './env.js';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(env.databaseUrl);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
