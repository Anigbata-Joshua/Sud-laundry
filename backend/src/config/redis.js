// Owner: Josh
// Shared foundation.
// Purpose: Redis client setup, used by services/cache.service.js and rate limiting.

import Redis from 'ioredis';
import { env } from './env.js';

let redisClient = null;

try {
    // Robust connection options to fail gracefully and fast if Redis is down
    const redisOptions = {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false, // Do not queue commands while offline
        connectTimeout: 2000,
        retryStrategy(times) {
            if (times > 2) {
                console.warn('⚠️ Redis server is unreachable. Bypassing cache services.');
                return null; // Stop retrying
            }
            return Math.min(times * 200, 1000);
        }
    };

    redisClient = new Redis(env.redisUrl, redisOptions);

    redisClient.on('connect', () => {
        console.log('✅ Redis Connected');
    });

    redisClient.on('error', (err) => {
        console.error('⚠️ Redis Connection Error:', err.message);
    });
} catch (error) {
    console.error('❌ Failed to initialize Redis client:', error.message);
}

export default redisClient;
