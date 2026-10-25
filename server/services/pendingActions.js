const crypto = require('crypto');

// In-memory pending actions cache with 5-minute TTL, single-use, bound to user id
const TTL_MS = 5 * 60 * 1000;
const pendingActionsMap = new Map();

/**
 * Create a new pending action.
 * @param {object} params
 * @param {string|object} params.userId
 * @param {string} params.tool - 'apply_leave' | 'cancel_leave' | 'approve_leave' | 'reject_leave'
 * @param {object} params.args
 * @param {string} params.summary - Human-readable summary for confirmation card
 * @returns {object} { id, tool, args, summary, expiresAt }
 */
const createPendingAction = ({ userId, tool, args, summary }) => {
  if (!userId || !tool) {
    throw new Error('userId and tool are required to create a pending action');
  }

  const id = crypto.randomUUID();
  const userIdStr = String(userId._id || userId);
  const now = Date.now();
  const expiresAt = now + TTL_MS;

  const pendingAction = {
    id,
    userId: userIdStr,
    tool,
    args,
    summary,
    createdAt: now,
    expiresAt,
  };

  pendingActionsMap.set(id, pendingAction);

  return {
    id,
    tool,
    args,
    summary,
    expiresAt,
  };
};

/**
 * Retrieve and consume (single-use) a pending action.
 * Verifies existence, expiration, and user ownership.
 * @param {string} id
 * @param {string|object} userId
 * @returns {object} { action } or { error, status }
 */
const consumePendingAction = (id, userId) => {
  if (!id) {
    return { error: 'Action ID is required', status: 400 };
  }

  const action = pendingActionsMap.get(id);
  if (!action) {
    return {
      error: 'This action has already been executed or does not exist.',
      status: 404,
    };
  }

  const userIdStr = String(userId?._id || userId);

  // Check user ownership
  if (action.userId !== userIdStr) {
    return {
      error: 'Access denied: You cannot confirm an action created by another user.',
      status: 403,
    };
  }

  // Check TTL expiration
  if (Date.now() > action.expiresAt) {
    pendingActionsMap.delete(id);
    return {
      error: 'This confirmation card has expired (5-minute limit). Please submit a new request.',
      status: 410,
    };
  }

  // Consume single-use action
  pendingActionsMap.delete(id);
  return { action };
};

/**
 * Discard / cancel a pending action without executing.
 * @param {string} id
 * @param {string|object} userId
 * @returns {boolean}
 */
const discardPendingAction = (id, userId) => {
  if (!id) return false;
  const action = pendingActionsMap.get(id);
  if (!action) return false;

  const userIdStr = String(userId?._id || userId);
  if (action.userId === userIdStr) {
    pendingActionsMap.delete(id);
    return true;
  }
  return false;
};

/**
 * Periodic cleanup of expired actions (runs every 60s).
 */
setInterval(() => {
  const now = Date.now();
  for (const [id, action] of pendingActionsMap.entries()) {
    if (now > action.expiresAt) {
      pendingActionsMap.delete(id);
    }
  }
}, 60 * 1000).unref();

module.exports = {
  createPendingAction,
  consumePendingAction,
  discardPendingAction,
  TTL_MS,
  _pendingActionsMap: pendingActionsMap,
};
