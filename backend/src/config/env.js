// Shared foundation.
// Purpose: load and export environment variables in one place.

import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

// A missing JWT secret must never fall back to a fixed, known string —
// that effectively lets anyone forge admin tokens. In production we fail
// fast at boot. In development we generate a random one per-process so
// local setup still works without a .env file, but every restart
// invalidates existing tokens, which makes the missing config obvious
// immediately instead of shipping a guessable secret.
function resolveJwtSecret() {
    if (process.env.JWT_SECRET) {
        return process.env.JWT_SECRET;
    }

    if (isProduction) {
        throw new Error('JWT_SECRET must be set in production. Refusing to start.');
    }

    console.warn(
        '⚠️  JWT_SECRET is not set — using a random secret for this process only. ' +
        'Set JWT_SECRET in backend/.env so tokens survive a restart.'
    );
    return crypto.randomBytes(48).toString('hex');
}

export const env = {
    port: parseInt(process.env.PORT, 10) || 3573,
    databaseUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/laundry',

    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/laundry',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    jwtSecret: resolveJwtSecret(),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',

    nodeEnv,
    isProduction,

    corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [],
    frontendURI: process.env.FRONTEND_URI || process.env.CLIENT_URL || 'http://localhost:5173',

    rateLimit: parseInt(process.env.RATE_LIMIT_WINDOW_MS || process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000, // 15 mins default
    generalRateLimitMax: parseInt(process.env.GENERAL_RATE_LIMIT_MAX || process.env.RATE_LIMIT_MAX, 10) || 300,
    rateLimitMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 20, // strict limiter max
    cancellationWindowMinutes: parseInt(process.env.CANCELLATION_WINDOW_MINUTES, 10) || 30,
    expressSurchargePercent: Number(process.env.EXPRESS_SURCHARGE_PERCENT) || 30,

    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',

    // Explicit opt-in for the "test_" reference bypass in makePayment.
    // Deliberately separate from NODE_ENV so it can never be accidentally
    // true in a real deployment just because NODE_ENV was left unset.
    allowTestPayments: process.env.ALLOW_TEST_PAYMENTS === 'true',
};

export default env;