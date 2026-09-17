// Shared foundation — build together as a team before individual module work.
// Purpose: connect to MongoDB using DATABASE_URL from .env

import mongoose from 'mongoose';
import { env } from './env.js';
import logger from '../utils/logger.js';

// Establish global event listeners once when the module loads
mongoose.set('strictQuery', true);

mongoose.connection.on('connected', () => {
    logger.info('✅ Connected to the Laundry App database successfully');
});

mongoose.connection.on('error', (error) => {
    logger.error('❌ Laundry App database error:', { error: error.message });
});

mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ Disconnected from Laundry App database. Attempting to reconnect...');
});

// Targeted database orchestration methods
export async function connectDatabase() {
    const options = {
        autoIndex: !env.isProduction,
        maxPoolSize: 50,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    };

    try {
        await mongoose.connect(env.mongoUri, options);
    } catch (error) {
        logger.error('❌ Critical: Initial database connection failed ->', { error: error.message });
        if (env.nodeEnv !== 'test') {
            process.exit(1);
        } else {
            throw error;
        }
    }
}

export async function closeDatabase() {
    try {
        await mongoose.connection.close();
        logger.info('✅ MongoDB connection closed safely');
    } catch (error) {
        logger.error('❌ Error during MongoDB shutdown:', { error: error.message });
    }
}

// Keep connectDB alias as default export for backward compatibility
export default connectDatabase;
