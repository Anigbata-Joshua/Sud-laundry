// Shared foundation.
// Purpose: load and export environment variables in one place.

import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
    port: parseInt(process.env.PORT, 10) || 3573,
    databaseUrl: process.env.DATABASE_URL || 'mongodb://localhost:27017/laundry',

    mongoUri: process.env.DATABASE_URL || 'mongodb://localhost:27017/laundry',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    jwtSecret: process.env.JWT_SECRET || 'secret-key-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',

    nodeEnv,
    isProduction: nodeEnv === 'production',

    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [],
    frontendURI: process.env.FRONTEND_URI || process.env.CLIENT_URL || 'http://localhost:5173',

    rateLimit: parseInt(process.env.RATE_LIMIT_WINDOW_MS || process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000, // 15 mins default
    generalRateLimitMax: parseInt(process.env.GENERAL_RATE_LIMIT_MAX || process.env.RATE_LIMIT_MAX, 10) || 100,
    rateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20, // strict limiter max
};

export default env;
