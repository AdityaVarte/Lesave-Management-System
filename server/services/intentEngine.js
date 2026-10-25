const { parseEntities } = require('./entityParser');

// In-memory cache for numbered list context with 5-minute TTL
const LIST_TTL_MS = 5 * 60 * 1000;
const userListContext = new Map();

/**
 * Store the last displayed list for a user.
 * @param {string|object} userId
 * @param {Array} list
 */
const storeUserList = (userId, list, meta = {}) => {
  if (!userId) return;
  const idStr = typeof userId === 'object' ? String(userId._id || userId) : String(userId);
  userListContext.set(idStr, {
    list: Array.isArray(list) ? list.map((item, index) => ({
      index: index + 1,
      _id: item._id ? item._id.toString() : null,
      employee_name: item.employee_snapshot?.name || 'Unknown',
      department: item.employee_snapshot?.department || '',
      leave_type: item.leave_type?.type_name || 'Leave',
      working_days: item.working_days,
      start_date: item.start_date,
      end_date: item.end_date,
      status: item.status,
      reason: item.reason || '',
    })) : [],
    filters: meta.filters || null,
    reportType: meta.reportType || null,
    timestamp: Date.now(),
  });
};

/**
 * Retrieve the active list context for a user.
 * Discards expired contexts (> 5 min).
 * @param {string|object} userId
 * @returns {Array|null}
 */
const getUserList = (userId) => {
  const ctx = getUserListContext(userId);
  return ctx ? ctx.list : null;
};

/**
 * Retrieve the full list context entry (list, filters, reportType, timestamp).
 */
const getUserListContext = (userId) => {
  if (!userId) return null;
  const idStr = typeof userId === 'object' ? String(userId._id || userId) : String(userId);
  const entry = userListContext.get(idStr);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > LIST_TTL_MS) {
    userListContext.delete(idStr);
    return null;
  }
  return entry;
};

/**
 * Clear list context for user.
 */
const clearUserList = (userId) => {
  if (userId) {
    const idStr = typeof userId === 'object' ? String(userId._id || userId) : String(userId);
    userListContext.delete(idStr);
  }
};

/**
 * Periodic cleanup of stale list contexts (runs every 5 minutes).
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of userListContext.entries()) {
    if (now - value.timestamp > LIST_TTL_MS) {
      userListContext.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

// Negative keywords that disqualify an intent match from corporate leave HR domain
const NEGATIVE_BALANCE_KEYWORDS = [
  'bank', 'account', 'money', 'credit', 'debit', 'wallet', 'crypto', 'savings', 'checking',
];

const NEGATIVE_PDF_KEYWORDS = [
  'bank', 'statement', 'account', 'money', 'tax', 'salary', 'payslip', 'paystub', 'invoice', 'resume', 'cv', 'bill',
];

/**
 * Normalizes input message: trims, lowercases, collapses whitespace.
 */
const normalizeMessage = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Intent definitions and scoring rules.
 */
const INTENT_DEFINITIONS = [
  {
    name: 'GREETING',
    patterns: [
      /^(hi|hello|hey|good morning|good afternoon|good evening|greetings)\b/i,
      /^hello there\b/i,
    ],
    exactWeight: 1.0,
    isHRTopic: true,
  },
  {
    name: 'THANKS',
    patterns: [
      /^(thanks|thank you|thank you so much|thx|thank u|appreciate it)\b/i,
      /\bthank you\b/i,
    ],
    exactWeight: 1.0,
    isHRTopic: true,
  },
  {
    name: 'HELP',
    patterns: [
      /^(help|what can you do|how to use|commands|capabilities|guide|what are your features)\b/i,
      /\bwhat can you do\b/i,
      /\bhow can you help\b/i,
    ],
    exactWeight: 1.0,
    isHRTopic: true,
  },
  {
    name: 'PDF_EXPORT',
    patterns: [
      /\bpdf\b/i,
      /\b(download|export|print|printable|generate)\b.*?\b(leaves?|requests?|history|balance|summary|pending|approved|rejected)\b/i,
      /\b(leaves?|requests?|history|balance|summary|pending|approved|rejected)\b.*?\b(report|document|file|pdf|printable|export|download)\b/i,
      /\b(leave\s+report|leave\s+document)\b/i,
      /\breport\s+of\s+.*?\b(leaves?|requests?|pending|approved|rejected)\b/i,
      /\b(send|give)\s+(me\s+)?(a\s+)?(the\s+)?report\b/i,
      /\bdepartment\s+(leave\s+)?summary\s+(pdf|report)\b/i,
      /\breport\s+of\s+pending\s+requests\b/i,
      /\b(download|export|generate)\s+.*?\b(report|pdf|document|file)\b/i,
      /\b(download|export|get|give me|send me)\s+.*?\b(pdf|report|document|file)\b/i,
      /^(pdf|report|send me report|give me report|export my leaves|download my leave report|make a pdf|print my leaves)$/i,
    ],
    disqualifiers: NEGATIVE_PDF_KEYWORDS,
    exactWeight: 1.0,
  },
  {
    name: 'BALANCE',
    patterns: [
      /\b(leave balance|my balance|check balance|show balance|remaining balance)\b/i,
      /\bhow many leaves? (do i have|left|remaining|can i take)\b/i,
      /\b(remaining leaves?|available leaves?|leaves? remaining|my remaining leaves?)\b/i,
      /\bhow much leave do i have left\b/i,
      /\bwhat is my balance\b/i,
      /\bwhat's my leave balance\b/i,
    ],
    disqualifiers: NEGATIVE_BALANCE_KEYWORDS,
    excludePatterns: [/\b(types?|policies|policy)\b/i, /\b(pdf|report|export|download|print|printable|document)\b/i],
    exactWeight: 0.95,
  },
  {
    name: 'MY_LEAVES',
    patterns: [
      /\b(my leaves?|my requests?|my leave requests?|show my leaves?|list my leaves?)\b/i,
      /\b(my approved leaves?|my pending leaves?|my rejected leaves?)\b/i,
      /\b(leaves i took|leaves taken by me|my leave history)\b/i,
      /\bshow my recent leaves\b/i,
      /\bmy leaves in \w+\b/i,
    ],
    excludePatterns: [/\bbalance\b/i, /^(was|is|did|has)\b/i, /\bstatus of\b/i, /\bcancel\b/i, /\b(pdf|report|download|export|print|printable|document)\b/i],
    exactWeight: 0.95,
  },
  {
    name: 'LEAVE_STATUS',
    patterns: [
      /\b(status of my (last|recent|latest)? leave|was my leave approved|is my leave approved)\b/i,
      /\b(latest leave status|last leave status|did my leave get approved)\b/i,
      /\bcheck status of my leave\b/i,
      /\bhas my leave been approved\b/i,
    ],
    exactWeight: 0.98,
  },
  {
    name: 'LEAVE_TYPES',
    patterns: [
      /\b(what leave types?|available leave types?|types of leaves?)\b/i,
      /\b(leave policies?|leave policy|leave rules?)\b/i,
      /\bmax days for \w+ leave\b/i,
      /\bhow many days of (sick|casual|paid|annual|medical) leave\b/i,
    ],
    exactWeight: 0.96,
  },
  {
    name: 'PENDING_LIST',
    patterns: [
      /\b(pending requests?|show pending requests?|pending leaves?|all pending leaves?)\b/i,
      /\b(list pending requests?|view pending requests?|pending leave requests?)\b/i,
      /\bshow pending requests\b/i,
    ],
    // "my pending leaves" belongs to MY_LEAVES, not PENDING_LIST
    excludePatterns: [/\bmy pending\b/i, /\b(pdf|download|export)\b/i, /\breport of\b/i],
    exactWeight: 0.95,
  },
  {
    name: 'DEPARTMENT_SUMMARY',
    patterns: [
      /\b(department (leave )?summary|leaves by department|department breakdown|department stats)\b/i,
      /\b(leave stats by department|department leave report)\b/i,
    ],
    excludePatterns: [/\b(pdf|download|export)\b/i],
    exactWeight: 0.95,
  },
  {
    name: 'MONTHLY_TREND',
    patterns: [
      /\b(monthly (leave )?trends?|leave trends?|trends? for (this year|\d{4}))\b/i,
      /\b(leave analytics by month|monthly breakdown of leaves?)\b/i,
      /\bleave trends? (this year|\d{4})?\b/i,
    ],
    exactWeight: 0.95,
  },
  {
    name: 'WHO_IS_ON_LEAVE',
    patterns: [
      /\bwho is (on leave|out|away|out of office)\b/i,
      /\bwho's (on leave|out|away|out of office)\b/i,
      /\bwho is absent\b/i,
      /\bwho will be on leave\b/i,
    ],
    exactWeight: 0.95,
  },
  {
    name: 'EMPLOYEE_LEAVES',
    patterns: [
      /\bleaves? of [a-zA-Z0-9@.]+/i,
      /\bshow [a-zA-Z0-9@.]+'s leaves\b/i,
      /\b[a-zA-Z0-9@.]+'s leaves\b/i,
      /\bleaves? for [a-zA-Z0-9@.]+/i,
    ],
    excludePatterns: [/\b(my|our)\b/i],
    exactWeight: 0.9,
  },
  {
    name: 'BULK_REFUSAL',
    patterns: [
      /\b(approve all|reject all|cancel all)\b/i,
    ],
    exactWeight: 1.0,
  },
  {
    name: 'APPLY_LEAVE',
    patterns: [
      /\b(apply( for)?( a)? leave|take( a)? leave|request( a)? leave)\b/i,
      /\b(apply|take)\s+(sick|casual|paid|annual|medical|personal)\s+leave\b/i,
      /\bhalf\s*day\s+(on\s+)?(monday|tuesday|wednesday|thursday|friday|today|tomorrow)\b/i,
      /\bleave from .+ to .+\b/i,
    ],
    exactWeight: 0.95,
  },
  {
    name: 'CANCEL_LEAVE',
    patterns: [
      /\bcancel( my)?( pending)? leave\b/i,
      /\bcancel leave\b/i,
      /\bcancel \d+\b/i,
      /\bcancel request\b/i,
    ],
    excludePatterns: [/\bcancel all\b/i],
    exactWeight: 0.95,
  },
  {
    name: 'APPROVE',
    patterns: [
      /\bapprove leave [a-f0-9]{24}\b/i,
      /\bapprove \d+\b/i,
      /\bapprove request \d+\b/i,
    ],
    excludePatterns: [/\bapprove all\b/i],
    exactWeight: 0.95,
  },
  {
    name: 'REJECT',
    patterns: [
      /\breject leave [a-f0-9]{24}\b/i,
      /\breject \d+\b/i,
      /\breject request \d+\b/i,
    ],
    excludePatterns: [/\breject all\b/i],
    exactWeight: 0.95,
  },
];

/**
 * Clarification questions for near-matching ambiguous intents.
 */
const CLARIFICATION_QUESTIONS = {
  'BALANCE_vs_MY_LEAVES': 'Did you want to check your leave balance or view your list of leave requests?',
  'MY_LEAVES_vs_PENDING_LIST': 'Did you want to see your own pending leaves or all company pending requests?',
};

/**
 * Match normalized text against defined intents.
 * 
 * @param {string} rawText
 * @param {object} user
 * @param {Date} [refDate]
 * @returns {{ intent: string, confidence: number, entities: object, clarificationQuestion?: string }|null}
 */
const matchIntent = (rawText, user = null, refDate = new Date()) => {
  const normalized = normalizeMessage(rawText);
  if (!normalized) return null;

  const entities = parseEntities(rawText, refDate);

  // Score candidate intents
  const scoredIntents = [];

  for (const def of INTENT_DEFINITIONS) {
    // 1. Check disqualifiers (e.g. bank account for balance)
    if (def.disqualifiers) {
      const hasDisqualifier = def.disqualifiers.some((word) =>
        new RegExp(`\\b${word}\\b`, 'i').test(normalized)
      );
      if (hasDisqualifier) {
        continue;
      }
    }

    // 2. Check exclusion patterns
    if (def.excludePatterns) {
      const isExcluded = def.excludePatterns.some((rx) => rx.test(normalized));
      if (isExcluded) {
        continue;
      }
    }

    // 3. Match patterns
    let matched = false;
    for (const pattern of def.patterns) {
      if (pattern.test(normalized)) {
        matched = true;
        break;
      }
    }

    if (matched) {
      let score = def.exactWeight || 0.9;

      // Entity reinforcement
      if (def.name === 'MY_LEAVES' && (entities.status || entities.dates)) {
        score = Math.min(1.0, score + 0.05);
      }
      if (def.name === 'WHO_IS_ON_LEAVE' && entities.dates) {
        score = Math.min(1.0, score + 0.05);
      }
      if (def.name === 'EMPLOYEE_LEAVES' && entities.employee) {
        score = Math.min(1.0, score + 0.08);
      }

      scoredIntents.push({
        intent: def.name,
        confidence: score,
        entities,
      });
    }
  }

  // Sort descending by confidence score
  scoredIntents.sort((a, b) => b.confidence - a.confidence);

  if (scoredIntents.length === 0) {
    return null; // Fall through to Gemini
  }

  const topMatch = scoredIntents[0];

  // If top match confidence is below cutoff (0.75), fall through
  if (topMatch.confidence < 0.75) {
    return null;
  }

  // Check for ambiguous near-matches (difference <= 0.05 between top 2 intents)
  if (scoredIntents.length > 1) {
    const secondMatch = scoredIntents[1];
    const diff = topMatch.confidence - secondMatch.confidence;

    if (diff < 0.05 && topMatch.intent !== secondMatch.intent) {
      const key1 = `${topMatch.intent}_vs_${secondMatch.intent}`;
      const key2 = `${secondMatch.intent}_vs_${topMatch.intent}`;
      const clarification = CLARIFICATION_QUESTIONS[key1] || CLARIFICATION_QUESTIONS[key2];

      if (clarification) {
        return {
          intent: 'CLARIFICATION',
          confidence: topMatch.confidence,
          entities,
          clarificationQuestion: clarification,
        };
      }
    }
  }

  return {
    intent: topMatch.intent,
    confidence: topMatch.confidence,
    entities,
  };
};

module.exports = {
  matchIntent,
  normalizeMessage,
  storeUserList,
  getUserList,
  getUserListContext,
  clearUserList,
  LIST_TTL_MS,
  _userListContext: userListContext,
};
