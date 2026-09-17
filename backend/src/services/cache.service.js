// Owner: Josh
// Shared foundation / shared business logic

import redisClient from '../config/redis.js';
import logger from '../utils/logger.js';

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
    logger.error(`Cache read failed for key "${key}":`, { error: err.message });
    return null;
  }
};

export const setCached = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  if (!isRedisReady()) return;
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    logger.error(`Cache write failed for key "${key}":`, { error: err.message });
  }
};

export const deleteCached = async (key) => {
  if (!isRedisReady()) return;
  try {
    await redisClient.del(key);
  } catch (err) {
    logger.error(`Cache delete failed for key "${key}":`, { error: err.message });
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
    logger.debug(`[Cache Hit] Key: ${key}`);
    return cached;
  }

  logger.debug(`[Cache Miss] Key: ${key}. Computing fresh value...`);
  const fresh = await computeFn();
  await setCached(key, fresh, ttlSeconds);
  return fresh;
};