// Owner: Dev 3 (SHARED — coordinate with Dev 2 on cache keys). See guides/ for the shared-file rule.
// Purpose: cache-aside helper for Redis, used for dashboard figures and catalog data.


import redisClient from '../config/redis.js'; // adjust to whatever the shared config actually exports

const DEFAULT_TTL_SECONDS = 300; // 5 minutes — short enough that stale dashboard numbers aren't a real problem


export const getCached = async (key) => {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error(`Cache read failed for key "${key}":`, err.message);
    return null;
  }
};


export const setCached = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  try {
    await redisClient.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch (err) {
    console.error(`Cache write failed for key "${key}":`, err.message);
  }
};

/**
 * Wraps a function so its result is cached automatically. Pass a function
 * that performs the actual (expensive) work — this handles the
 * check-cache-first / compute-and-store-on-miss pattern for you.
 *
 * Example:
 *   const data = await withCache(
 *     `report:revenue:${branch_id || 'all'}:${startDate}:${endDate}`,
 *     () => getRevenue({ branch_id, startDate, endDate })
 *   );
 */

export const withCache = async (key, computeFn, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const cached = await getCached(key);
  if (cached !== null) return cached;

  const fresh = await computeFn();
  await setCached(key, fresh, ttlSeconds);
  return fresh;
};