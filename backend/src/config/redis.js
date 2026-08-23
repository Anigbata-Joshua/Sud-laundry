// Shared foundation.
// Purpose: Redis client setup, used by services/cache.service.js and rate limiting.

import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.redisUrl);

redis.on('connect', () => {
    console.log('✓ Redis connected');
});

redis.on('error', (error) => {
    console.error('✗ Redis error:', error.message);
});

export default redis;
