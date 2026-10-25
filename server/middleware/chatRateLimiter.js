/**
 * In-memory per-user rate limiter for the Chatbot API.
 * Limit: 15 requests per minute per authenticated user.
 */
const rateMap = new Map();

// Periodic cleanup of stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateMap.entries()) {
    if (now - record.startTime > 60000) {
      rateMap.delete(key);
    }
  }
}, 300000);

const chatRateLimiter = (req, res, next) => {
  const userId = req.user?._id?.toString() || req.ip || 'anonymous';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 15;

  let record = rateMap.get(userId);

  if (!record || now - record.startTime > windowMs) {
    record = { startTime: now, count: 1 };
    rateMap.set(userId, record);
    return next();
  }

  record.count += 1;

  if (record.count > maxRequests) {
    const retryAfter = Math.ceil((record.startTime + windowMs - now) / 1000);
    return res.status(429).json({
      message: `Too many chat requests. Please wait ${retryAfter} seconds before trying again.`,
      retryAfter,
    });
  }

  next();
};

module.exports = chatRateLimiter;
