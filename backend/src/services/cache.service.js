// Owner: Josh
// Shared foundation / shared business logic

import redisClient from '../config/redis.js';

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

// Helper to check if Redis is active and ready
const isRedisReady = () => {
  return redisClient && redisClient.status === 'ready';
};

export const getCached = async (key) => {
  if (!isRedisReady()) return null;
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error(`Cache read failed for key "${key}":`, err.message);
    return null;
  }
};

export const setCached = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  if (!isRedisReady()) return;
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error(`Cache write failed for key "${key}":`, err.message);
  }
};

export const deleteCached = async (key) => {
  if (!isRedisReady()) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    console.error(`Cache delete failed for key "${key}":`, err.message);
  }
};

/**
 * Wraps a function so its result is cached automatically.
 */
export const withCache = async (key, computeFn, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  if (!isRedisReady()) {
    return await computeFn(); // Bypass caching completely
  }

  const cached = await getCached(key);
  if (cached !== null) {
    console.log(`[Cache Hit] Key: ${key}`);
    return cached;
  }

  console.log(`[Cache Miss] Key: ${key}. Computing fresh value...`);
  const fresh = await computeFn();
  await setCached(key, fresh, ttlSeconds);
  return fresh;
};