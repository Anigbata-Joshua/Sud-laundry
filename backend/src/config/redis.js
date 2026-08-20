// Shared foundation.
// Purpose: Redis client setup, used by services/cache.service.js and rate limiting.

import Redis from 'ioredis';
import { env } from './env.js';

let redisClient;
try {
    redisClient = new Redis(env.redisUrl);
    redisClient.on('connect', () => console.log('Redis Connected'));
    redisClient.on('error', (err) => console.error('Redis Connection Error:', err));
} catch (error) {
    console.error('Failed to initialize Redis client:', error.message);
}

export default redisClient;
