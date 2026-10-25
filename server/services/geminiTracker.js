const { getCalcuttaTodayString } = require('../utils/dateUtils');

const DEDUPE_TTL_MS = 60 * 1000; // 60 seconds
const MAX_CACHE_ENTRIES = 100;

// In-memory dedupe cache: Map(key -> { reply, timestamp })
const dedupeCache = new Map();

// In-memory daily usage tracking: Map(userId -> { dateStr, count })
const dailyUsageMap = new Map();

/**
 * Get daily limit from env (defaults to 50).
 */
const getDailyLimit = () => {
  const envVal = parseInt(process.env.GEMINI_DAILY_LIMIT_PER_USER, 10);
  return Number.isInteger(envVal) && envVal > 0 ? envVal : 50;
};

/**
 * Check if a user has exceeded their daily limit and increment usage if allowed.
 * @param {string|object} userId
 * @returns {{ allowed: boolean, count: number, limit: number }}
 */
const checkAndIncrementDailyLimit = (userId) => {
  const idStr = String(userId?._id || userId);
  const today = getCalcuttaTodayString();
  const limit = getDailyLimit();

  const entry = dailyUsageMap.get(idStr);

  if (entry && entry.dateStr === today) {
    if (entry.count >= limit) {
      return { allowed: false, count: entry.count, limit };
    }
    entry.count += 1;
    return { allowed: true, count: entry.count, limit };
  }

  // New day or first request for user
  dailyUsageMap.set(idStr, { dateStr: today, count: 1 });
  return { allowed: true, count: 1, limit };
};

/**
 * Retrieve cached reply if active and not expired.
 * Key strictly binds userId, role, and normalized message.
 */
const getDedupeCache = (userId, role, normalizedMessage) => {
  if (!userId || !normalizedMessage) return null;
  const idStr = String(userId?._id || userId);
  const key = `${idStr}:${role}:${normalizedMessage.trim().toLowerCase()}`;

  const entry = dedupeCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > DEDUPE_TTL_MS) {
    dedupeCache.delete(key);
    return null;
  }

  return entry.reply;
};

/**
 * Store reply in dedupe cache.
 * Critical: Never cache replies that generated write action cards or errors.
 */
const setDedupeCache = (userId, role, normalizedMessage, reply, pendingAction = null) => {
  if (!userId || !normalizedMessage || !reply) return;
  // Never cache write confirmation cards
  if (pendingAction) return;

  const idStr = String(userId?._id || userId);
  const key = `${idStr}:${role}:${normalizedMessage.trim().toLowerCase()}`;

  // Enforce size cap with FIFO eviction
  if (dedupeCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = dedupeCache.keys().next().value;
    if (oldestKey) dedupeCache.delete(oldestKey);
  }

  dedupeCache.set(key, {
    reply,
    timestamp: Date.now(),
  });
};

/**
 * Reset trackers (primarily for unit tests).
 */
const _resetTrackers = () => {
  dedupeCache.clear();
  dailyUsageMap.clear();
};

module.exports = {
  checkAndIncrementDailyLimit,
  getDedupeCache,
  setDedupeCache,
  getDailyLimit,
  _resetTrackers,
  _dedupeCache: dedupeCache,
  _dailyUsageMap: dailyUsageMap,
};
