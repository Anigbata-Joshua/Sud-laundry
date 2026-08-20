// Shared foundation.
// Purpose: load and export environment variables in one place.

import dotenv from 'dotenv';

dotenv.config();

export const env = {
    port: process.env.PORT || 3573,
    databaseUrl: process.env.DATABASE_URL || 'mongodb://localhost:27017/laundry',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    jwtSecret: process.env.JWT_SECRET || 'secret-key-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
};
export default env;
