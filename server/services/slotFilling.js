const {
  extractLeaveType,
  extractDateRange,
  parseSingleDate,
} = require('./entityParser');
const dataService = require('./dataService');
const { formatDisplayDate } = require('../utils/dateUtils');

const SLOT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const slotStateMap = new Map();

/**
 * Check if message is an explicit cancellation command.
 */
const isCancelMessage = (text) => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (/\bcancel\s+(my\s+)?(pending\s+)?leaves?\b/i.test(trimmed) || /\bcancel\s+\d+\b/i.test(trimmed) || /\bcancel\s+request\b/i.test(trimmed)) {
    return false;
  }
  return /^(cancel|never mind|nevermind|stop|abort|forget it|drop it|quit)\b/i.test(trimmed);
};

/**
 * Get active slot state for a user.
 * Discards expired states (> 5 min).
 */
const getSlotState = (userId) => {
  if (!userId) return null;
  const idStr = String(userId._id || userId);
  const entry = slotStateMap.get(idStr);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > SLOT_TTL_MS) {
    slotStateMap.delete(idStr);
    return null;
  }
  return entry;
};

/**
 * Store slot state for a user.
 */
const setSlotState = (userId, state) => {
  if (!userId) return;
  const idStr = String(userId._id || userId);
  slotStateMap.set(idStr, {
    ...state,
    timestamp: Date.now(),
  });
};

/**
 * Clear slot state for a user.
 */
const clearSlotState = (userId) => {
  if (userId) {
    const idStr = String(userId._id || userId);
    slotStateMap.delete(idStr);
  }
};

/**
 * Periodic cleanup of expired slot states.
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of slotStateMap.entries()) {
    if (now - value.timestamp > SLOT_TTL_MS) {
      slotStateMap.delete(key);
    }
  }
}, 60 * 1000).unref();

/**
 * Determine the next missing slot for APPLY_LEAVE.
 * @param {object} slots
 * @returns {'leaveType'|'dates'|'reason'|null}
 */
const getNextMissingApplySlot = (slots) => {
  if (!slots.leaveType) return 'leaveType';
  if (!slots.startDate || !slots.endDate) return 'dates';
  if (!slots.reason || slots.reason.trim().length < 10) return 'reason';
  return null;
};

/**
 * Prompt question for the next missing slot.
 */
const getPromptForSlot = (missingSlot, slots) => {
  switch (missingSlot) {
    case 'leaveType':
      return 'Which type of leave would you like to apply for? (Casual, Sick, or Paid)';
    case 'dates':
      return `For what date or date range would you like to take ${slots.leaveType || ''} leave?`;
    case 'reason':
      return 'Please provide a reason for your leave (at least 10 characters).';
    default:
      return null;
  }
};

/**
 * Process slot filling step for APPLY_LEAVE.
 * @param {object} user
 * @param {string} text
 * @param {object} currentState
 * @returns {Promise<object>} { complete, reply, slots, dropped }
 */
const processApplySlotFilling = async (user, text, currentState) => {
  const slots = { ...currentState.slots };
  const missing = getNextMissingApplySlot(slots);

  if (!missing) {
    clearSlotState(user._id);
    return { complete: true, slots };
  }

  // 1. Processing 'leaveType' slot
  if (missing === 'leaveType') {
    const extractedType = extractLeaveType(text);
    if (!extractedType) {
      return {
        complete: false,
        reply: 'Please specify a valid leave type: Casual, Sick, or Paid.',
      };
    }
    slots.leaveType = extractedType;

    // Check if user also provided dates or reason in this message
    const dateRange = extractDateRange(text);
    if (dateRange) {
      slots.startDate = dateRange.from;
      slots.endDate = dateRange.to;
      slots.isHalfDay = /\bhalf\s*day\b/i.test(text);
    }

    // Check next missing
    const nextMissing = getNextMissingApplySlot(slots);
    if (!nextMissing) {
      // Validate full application before completing
      try {
        await dataService.validateLeaveApplication(user, {
          leave_type_name: slots.leaveType,
          start_date: slots.startDate,
          end_date: slots.endDate,
          is_half_day: slots.isHalfDay,
          reason: slots.reason,
        });
        clearSlotState(user._id);
        return { complete: true, slots };
      } catch (err) {
        // Reset invalid dates
        slots.startDate = null;
        slots.endDate = null;
        setSlotState(user._id, { intent: 'APPLY_LEAVE', slots });
        return { complete: false, reply: `${err.message}. Please provide new dates.` };
      }
    }

    setSlotState(user._id, { intent: 'APPLY_LEAVE', slots });
    return {
      complete: false,
      reply: getPromptForSlot(nextMissing, slots),
    };
  }

  // 2. Processing 'dates' slot
  if (missing === 'dates') {
    const isHalf = /\bhalf\s*day\b/i.test(text);
    const dateRange = extractDateRange(text);
    let start = null;
    let end = null;

    if (dateRange) {
      start = dateRange.from;
      end = dateRange.to;
    } else {
      const single = parseSingleDate(text);
      if (single) {
        start = single;
        end = single;
      }
    }

    if (!start || !end) {
      return {
        complete: false,
        reply: 'I could not understand the dates. Please specify a date or range (e.g. "tomorrow", "20 Oct to 22 Oct", or "2026-10-20").',
      };
    }

    // Pre-validate dates with dataService
    try {
      await dataService.validateLeaveApplication(user, {
        leave_type_name: slots.leaveType,
        start_date: start,
        end_date: end,
        is_half_day: isHalf || slots.isHalfDay,
        reason: undefined, // reason not validated yet
      });

      slots.startDate = start;
      slots.endDate = end;
      slots.isHalfDay = isHalf || slots.isHalfDay || false;
    } catch (err) {
      return {
        complete: false,
        reply: `${err.message}. Please provide valid dates.`,
      };
    }

    const nextMissing = getNextMissingApplySlot(slots);
    if (!nextMissing) {
      clearSlotState(user._id);
      return { complete: true, slots };
    }

    setSlotState(user._id, { intent: 'APPLY_LEAVE', slots });
    return {
      complete: false,
      reply: getPromptForSlot(nextMissing, slots),
    };
  }

  // 3. Processing 'reason' slot
  if (missing === 'reason') {
    const cleanReason = text.trim();
    if (cleanReason.length < 10) {
      return {
        complete: false,
        reply: 'Reason must be at least 10 characters. Please provide a brief explanation.',
      };
    }

    slots.reason = cleanReason;

    // Re-validate everything including balance and overlap
    try {
      await dataService.validateLeaveApplication(user, {
        leave_type_name: slots.leaveType,
        start_date: slots.startDate,
        end_date: slots.endDate,
        is_half_day: slots.isHalfDay,
        reason: slots.reason,
      });

      clearSlotState(user._id);
      return { complete: true, slots };
    } catch (err) {
      clearSlotState(user._id);
      return {
        complete: false,
        reply: `Application error: ${err.message}. Your draft has been reset.`,
      };
    }
  }

  return { complete: false, reply: 'Please provide the missing details.' };
};

/**
 * Process slot filling step for REJECT (missing rejection reason).
 */
const processRejectSlotFilling = async (user, text, currentState) => {
  const cleanReason = text.trim();
  if (!cleanReason) {
    return {
      complete: false,
      reply: 'Please provide a reason for rejecting this leave request.',
    };
  }

  clearSlotState(user._id);
  return {
    complete: true,
    slots: {
      leaveId: currentState.slots.leaveId,
      listIndex: currentState.slots.listIndex,
      reason: cleanReason,
    },
  };
};

/**
 * Check if message contains PDF words (pdf, report, export, download)
 * without being disqualified by banking/payroll/invoice terms.
 */
const isPdfKeywordMessage = (text) => {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  if (!/\b(pdf|report|export|download)\b/i.test(trimmed)) {
    return false;
  }
  const disqualifiers = ['bank', 'statement', 'account', 'money', 'tax', 'salary', 'payslip', 'paystub', 'invoice', 'resume', 'cv', 'bill'];
  if (disqualifiers.some((w) => new RegExp(`\\b${w}\\b`, 'i').test(trimmed))) {
    return false;
  }
  return true;
};

module.exports = {
  getSlotState,
  setSlotState,
  clearSlotState,
  isCancelMessage,
  isPdfKeywordMessage,
  getNextMissingApplySlot,
  getPromptForSlot,
  processApplySlotFilling,
  processRejectSlotFilling,
  SLOT_TTL_MS,
  _slotStateMap: slotStateMap,
};
