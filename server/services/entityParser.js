const {
  getCalcuttaTodayString,
  getCalcuttaMonthBounds,
  formatDisplayDate,
  formatISODate,
} = require('../utils/dateUtils');

const MONTH_MAP = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const WEEKDAY_MAP = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const DEPARTMENTS = ['Engineering', 'Design', 'Finance', 'HR', 'Marketing', 'Operations'];

const LEAVE_TYPE_SYNONYMS = {
  casual: 'Casual',
  personal: 'Casual',
  sick: 'Sick',
  medical: 'Sick',
  health: 'Sick',
  doctor: 'Sick',
  illness: 'Sick',
  paid: 'Paid',
  earned: 'Paid',
  annual: 'Paid',
  vacation: 'Paid',
  privilege: 'Paid',
};

/**
 * Format year, month, day into standard YYYY-MM-DD.
 */
const toISO = (year, month, day) => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/**
 * Check if a year is a leap year.
 */
const isLeapYear = (year) => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

/**
 * Get number of days in a month.
 */
const getDaysInMonth = (year, month) => {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
};

/**
 * Resolve single date string/token to YYYY-MM-DD.
 * @param {string} token
 * @param {Date} [refDate]
 * @returns {string|null}
 */
const parseSingleDate = (token, refDate = new Date()) => {
  if (!token || typeof token !== 'string') return null;
  const t = token.trim().toLowerCase();

  const todayStr = getCalcuttaTodayString(refDate);
  const [curYear, curMonth, curDay] = todayStr.split('-').map(Number);
  // Current day of week in Asia/Calcutta
  const currentCalcuttaDate = new Date(`${todayStr}T12:00:00.000+05:30`);
  const curDayOfWeek = currentCalcuttaDate.getDay(); // 0 is Sun, 1 is Mon...

  // 1. Relative keywords: today, tomorrow, yesterday
  if (t === 'today') {
    return todayStr;
  }
  if (t === 'tomorrow') {
    const d = new Date(currentCalcuttaDate);
    d.setDate(d.getDate() + 1);
    return formatISODate(d);
  }
  if (t === 'yesterday') {
    const d = new Date(currentCalcuttaDate);
    d.setDate(d.getDate() - 1);
    return formatISODate(d);
  }

  // 2. ISO format YYYY-MM-DD
  const isoMatch = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= getDaysInMonth(y, m)) {
      return toISO(y, m, d);
    }
  }

  // 3. Slash format DD/MM/YYYY
  const slashMatch = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const d = Number(slashMatch[1]);
    const m = Number(slashMatch[2]);
    const y = Number(slashMatch[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= getDaysInMonth(y, m)) {
      return toISO(y, m, d);
    }
  }

  // 4. "20 oct", "20 october", "20 oct 2026", "20 october 2026"
  const dayMonthMatch = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)(?:\s+(\d{4}))?$/);
  if (dayMonthMatch) {
    const d = Number(dayMonthMatch[1]);
    const mStr = dayMonthMatch[2].toLowerCase();
    const y = dayMonthMatch[3] ? Number(dayMonthMatch[3]) : curYear;
    const m = MONTH_MAP[mStr];
    if (m && d >= 1 && d <= getDaysInMonth(y, m)) {
      return toISO(y, m, d);
    }
  }

  // 4b. "oct 20", "october 20, 2026"
  const monthDayMatch = t.match(/^([a-zA-Z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?$/);
  if (monthDayMatch) {
    const mStr = monthDayMatch[1].toLowerCase();
    const d = Number(monthDayMatch[2]);
    const y = monthDayMatch[3] ? Number(monthDayMatch[3]) : curYear;
    const m = MONTH_MAP[mStr];
    if (m && d >= 1 && d <= getDaysInMonth(y, m)) {
      return toISO(y, m, d);
    }
  }

  // 5. Weekday references: "this monday", "next monday", "this friday", "next friday", "on friday", "friday"
  const weekdayMatch = t.match(/^(?:(this|next|coming)\s+)?([a-zA-Z]+)$/);
  if (weekdayMatch) {
    const modifier = weekdayMatch[1]?.toLowerCase();
    const dayName = weekdayMatch[2]?.toLowerCase();
    const targetDayOfWeek = WEEKDAY_MAP[dayName];

    if (targetDayOfWeek !== undefined) {
      if (modifier === 'next') {
        // Next week's occurrence: move to next week (days until next Monday), then to target
        // Days until next Monday:
        const daysUntilNextMon = ((1 - curDayOfWeek + 7) % 7) || 7;
        const nextMon = new Date(currentCalcuttaDate);
        nextMon.setDate(nextMon.getDate() + daysUntilNextMon);
        // From next Monday, add (targetDayOfWeek - 1 + 7) % 7
        const offset = (targetDayOfWeek - 1 + 7) % 7;
        nextMon.setDate(nextMon.getDate() + offset);
        return formatISODate(nextMon);
      } else {
        // "this <day>" or bare weekday: within the current cycle
        let diff = targetDayOfWeek - curDayOfWeek;
        if (diff < 0) {
          diff += 7; // next upcoming
        }
        const d = new Date(currentCalcuttaDate);
        d.setDate(d.getDate() + diff);
        return formatISODate(d);
      }
    }
  }

  return null;
};

/**
 * Extract a candidate date from a string that may contain leading words.
 */
const extractDateCandidate = (str, refDate) => {
  if (!str) return null;
  const direct = parseSingleDate(str, refDate);
  if (direct) return direct;

  // DD/MM/YYYY
  const slash = str.match(/\b(\d{1,2}\/\d{1,2}\/\d{4})\b/);
  if (slash) {
    const d = parseSingleDate(slash[1], refDate);
    if (d) return d;
  }

  // YYYY-MM-DD
  const iso = str.match(/\b(\d{4}-\d{1,2}-\d{1,2})\b/);
  if (iso) {
    const d = parseSingleDate(iso[1], refDate);
    if (d) return d;
  }

  // 20 oct [2026] or oct 20 [2026]
  const dMonth = str.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+(?:\s+\d{4})?)\b/);
  if (dMonth) {
    const d = parseSingleDate(dMonth[1], refDate);
    if (d) return d;
  }

  // Relative keywords
  const rel = str.match(/\b(today|tomorrow|yesterday|(?:this|next|coming)\s+[a-zA-Z]+)\b/i);
  if (rel) {
    const d = parseSingleDate(rel[1], refDate);
    if (d) return d;
  }

  return null;
};

/**
 * Extract date expressions and date ranges from text.
 * @param {string} text
 * @param {Date} [refDate]
 * @returns {object|null}
 */
const extractDateRange = (text, refDate = new Date()) => {
  if (!text || typeof text !== 'string') return null;
  const raw = text.trim();
  const lower = raw.toLowerCase();

  const todayStr = getCalcuttaTodayString(refDate);
  const [curYear, curMonth, curDay] = todayStr.split('-').map(Number);
  const currentCalcuttaDate = new Date(`${todayStr}T12:00:00.000+05:30`);
  const curDayOfWeek = currentCalcuttaDate.getDay();

  // ─── Range Pattern: "from X to Y", "X to Y", "between X and Y", "X - Y", "X until Y" ───
  const rangePatterns = [
    /(?:between|from)\s+([0-9a-zA-Z\/\s,.-]+?)\s+(?:and|to|until|-)\s+([0-9a-zA-Z\/\s,.-]+?)(?:\s+(?:for|because|as|due to|reason)|$)/i,
    /([0-9a-zA-Z\/\s]+?)\s+(?:to|until|-)\s+([0-9a-zA-Z\/\s]+?)(?:\s+(?:for|because|as|due to|reason)|$)/i,
  ];

  for (const pattern of rangePatterns) {
    const match = lower.match(pattern);
    if (match) {
      const part1 = match[1].trim();
      const part2 = match[2].trim();
      const fromParsed = extractDateCandidate(part1, refDate);
      const toParsed = extractDateCandidate(part2, refDate);

      if (fromParsed && toParsed) {
        return {
          from: fromParsed,
          to: toParsed,
          fromDisplay: formatDisplayDate(fromParsed),
          toDisplay: formatDisplayDate(toParsed),
          resolvedString: `${formatDisplayDate(fromParsed)} to ${formatDisplayDate(toParsed)}`,
        };
      }
    }
  }

  // ─── Relative Periods: "this week", "next week", "last week" ───
  if (/\bthis week\b/i.test(lower)) {
    // Monday of this week to Sunday of this week
    const monDiff = ((curDayOfWeek + 6) % 7); // days since this week's Monday
    const monday = new Date(currentCalcuttaDate);
    monday.setDate(monday.getDate() - monDiff);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const fromStr = formatISODate(monday);
    const toStr = formatISODate(sunday);
    return {
      from: fromStr,
      to: toStr,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `this week (${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
    };
  }

  if (/\bnext week\b/i.test(lower)) {
    const daysUntilNextMon = ((1 - curDayOfWeek + 7) % 7) || 7;
    const monday = new Date(currentCalcuttaDate);
    monday.setDate(monday.getDate() + daysUntilNextMon);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const fromStr = formatISODate(monday);
    const toStr = formatISODate(sunday);
    return {
      from: fromStr,
      to: toStr,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `next week (${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
    };
  }

  if (/\blast week\b/i.test(lower)) {
    const monDiff = ((curDayOfWeek + 6) % 7) + 7;
    const monday = new Date(currentCalcuttaDate);
    monday.setDate(monday.getDate() - monDiff);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);

    const fromStr = formatISODate(monday);
    const toStr = formatISODate(sunday);
    return {
      from: fromStr,
      to: toStr,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `last week (${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
    };
  }

  // ─── Relative Month: "this month", "last month", "next month" ───
  if (/\bthis month\b/i.test(lower)) {
    const bounds = getCalcuttaMonthBounds(curYear, curMonth);
    const fromStr = toISO(curYear, curMonth, 1);
    const toStr = toISO(curYear, curMonth, getDaysInMonth(curYear, curMonth));
    return {
      from: fromStr,
      to: toStr,
      month: `${curYear}-${String(curMonth).padStart(2, '0')}`,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `this month (${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
    };
  }

  if (/\blast month\b/i.test(lower)) {
    const lastM = curMonth === 1 ? 12 : curMonth - 1;
    const lastY = curMonth === 1 ? curYear - 1 : curYear;
    const fromStr = toISO(lastY, lastM, 1);
    const toStr = toISO(lastY, lastM, getDaysInMonth(lastY, lastM));
    return {
      from: fromStr,
      to: toStr,
      month: `${lastY}-${String(lastM).padStart(2, '0')}`,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `last month (${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
    };
  }

  if (/\bnext month\b/i.test(lower)) {
    const nextM = curMonth === 12 ? 1 : curMonth + 1;
    const nextY = curMonth === 12 ? curYear + 1 : curYear;
    const fromStr = toISO(nextY, nextM, 1);
    const toStr = toISO(nextY, nextM, getDaysInMonth(nextY, nextM));
    return {
      from: fromStr,
      to: toStr,
      month: `${nextY}-${String(nextM).padStart(2, '0')}`,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `next month (${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
    };
  }

  // ─── Quarters: Q1, Q2, Q3, Q4, last quarter, this quarter ───
  if (/\b(?:last|previous)\s+quarter\b/i.test(lower)) {
    const curQ = Math.floor((curMonth - 1) / 3) + 1;
    const targetQ = curQ === 1 ? 4 : curQ - 1;
    const targetY = curQ === 1 ? curYear - 1 : curYear;
    const quarters = {
      1: { startM: 1, endM: 3 },
      2: { startM: 4, endM: 6 },
      3: { startM: 7, endM: 9 },
      4: { startM: 10, endM: 12 },
    };
    const { startM, endM } = quarters[targetQ];
    const fromStr = toISO(targetY, startM, 1);
    const toStr = toISO(targetY, endM, getDaysInMonth(targetY, endM));
    return {
      from: fromStr,
      to: toStr,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `last quarter (Q${targetQ} ${targetY}: ${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
    };
  }

  if (/\b(?:this|current)\s+quarter\b/i.test(lower)) {
    const curQ = Math.floor((curMonth - 1) / 3) + 1;
    const quarters = {
      1: { startM: 1, endM: 3 },
      2: { startM: 4, endM: 6 },
      3: { startM: 7, endM: 9 },
      4: { startM: 10, endM: 12 },
    };
    const { startM, endM } = quarters[curQ];
    const fromStr = toISO(curYear, startM, 1);
    const toStr = toISO(curYear, endM, getDaysInMonth(curYear, endM));
    return {
      from: fromStr,
      to: toStr,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `this quarter (Q${curQ} ${curYear}: ${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
    };
  }

  const quarterMatch = lower.match(/\b(q[1-4])(?:\s+(\d{4}))?\b/i);
  if (quarterMatch) {
    const q = quarterMatch[1].toLowerCase();
    const y = quarterMatch[2] ? Number(quarterMatch[2]) : curYear;
    const quarters = {
      q1: { startM: 1, endM: 3 },
      q2: { startM: 4, endM: 6 },
      q3: { startM: 7, endM: 9 },
      q4: { startM: 10, endM: 12 },
    };
    const { startM, endM } = quarters[q];
    const fromStr = toISO(y, startM, 1);
    const toStr = toISO(y, endM, getDaysInMonth(y, endM));
    return {
      from: fromStr,
      to: toStr,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `${q.toUpperCase()} ${y} (${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
    };
  }

  // ─── Relative Years: this year, last year ───
  if (/\bthis year\b/i.test(lower)) {
    const fromStr = toISO(curYear, 1, 1);
    const toStr = toISO(curYear, 12, 31);
    return {
      from: fromStr,
      to: toStr,
      year: curYear,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `this year (${curYear})`,
    };
  }

  if (/\blast year\b/i.test(lower)) {
    const prevYear = curYear - 1;
    const fromStr = toISO(prevYear, 1, 1);
    const toStr = toISO(prevYear, 12, 31);
    return {
      from: fromStr,
      to: toStr,
      year: prevYear,
      fromDisplay: formatDisplayDate(fromStr),
      toDisplay: formatDisplayDate(toStr),
      resolvedString: `last year (${prevYear})`,
    };
  }

  // ─── Standalone 4-digit Year: "in 2026", "2026" ───
  const standaloneYearMatch = lower.match(/\b(?:in\s+|for\s+)?(20\d\d)\b/);
  if (standaloneYearMatch) {
    const yStr = standaloneYearMatch[1];
    const idx = lower.indexOf(yStr);
    const beforePart = lower.slice(Math.max(0, idx - 15), idx).trim();
    const afterPart = lower.slice(idx + 4, Math.min(lower.length, idx + 15)).trim();
    const isPartOfFullDate = /(?:\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|-|\/)$/i.test(beforePart) ||
                            /^[-|\/]/.test(afterPart);
    if (!isPartOfFullDate) {
      const y = Number(yStr);
      const fromStr = toISO(y, 1, 1);
      const toStr = toISO(y, 12, 31);
      return {
        from: fromStr,
        to: toStr,
        year: y,
        fromDisplay: formatDisplayDate(fromStr),
        toDisplay: formatDisplayDate(toStr),
        resolvedString: `${y} (${formatDisplayDate(fromStr)} to ${formatDisplayDate(toStr)})`,
      };
    }
  }

  // ─── Named Month: "in september", "september 2026", "september" ───
  const monthMatch = lower.match(/\b(?:in\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+(\d{4}))?\b/i);
  if (monthMatch) {
    // Make sure it wasn't part of a day like "20 oct" (checked earlier, but check prefix)
    const mStr = monthMatch[1].toLowerCase();
    const m = MONTH_MAP[mStr];
    const y = monthMatch[2] ? Number(monthMatch[2]) : curYear;
    if (m) {
      // Check if text has a digit right before it (e.g. "20 sep")
      const beforeIndex = lower.indexOf(mStr);
      const prefix = lower.slice(Math.max(0, beforeIndex - 4), beforeIndex).trim();
      if (!/\d+$/.test(prefix)) {
        const fromStr = toISO(y, m, 1);
        const toStr = toISO(y, m, getDaysInMonth(y, m));
        return {
          from: fromStr,
          to: toStr,
          month: `${y}-${String(m).padStart(2, '0')}`,
          fromDisplay: formatDisplayDate(fromStr),
          toDisplay: formatDisplayDate(toStr),
          resolvedString: `${mStr.charAt(0).toUpperCase() + mStr.slice(1)} ${y}`,
        };
      }
    }
  }

  // ─── Single Date / Day (today, tomorrow, next monday, 20 oct, 2026-10-20, 20/10/2026) ───
  // Tokenize or extract single date patterns
  const singleDatePatterns = [
    /\b(today|tomorrow|yesterday)\b/i,
    /\b(this|next|coming)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i,
    /\b(?:on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(\d{4}-\d{1,2}-\d{1,2})\b/,
    /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
    /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)(?:\s+\d{4})?)\b/i,
  ];

  for (const pattern of singleDatePatterns) {
    const match = lower.match(pattern);
    if (match) {
      const parsed = parseSingleDate(match[0].replace(/^on\s+/i, ''), refDate);
      if (parsed) {
        return {
          from: parsed,
          to: parsed,
          fromDisplay: formatDisplayDate(parsed),
          toDisplay: formatDisplayDate(parsed),
          resolvedString: formatDisplayDate(parsed),
        };
      }
    }
  }

  return null;
};

/**
 * Extract status entity from text.
 * @param {string} text
 * @returns {'Pending'|'Approved'|'Rejected'|null}
 */
const extractStatus = (text) => {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\b(pending|awaiting approval)\b/.test(lower)) return 'Pending';
  if (/\b(approved|accepted)\b/.test(lower)) return 'Approved';
  if (/\b(rejected|denied|declined)\b/.test(lower)) return 'Rejected';
  return null;
};

/**
 * Extract department entity from text.
 * @param {string} text
 * @returns {string|null}
 */
const extractDepartment = (text) => {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const dept of DEPARTMENTS) {
    const regex = new RegExp(`\\b${dept.toLowerCase()}\\b`, 'i');
    if (regex.test(lower)) {
      return dept;
    }
  }
  return null;
};

/**
 * Extract leave type entity from text.
 * Handles synonyms: sick/medical/health -> Sick, paid/earned/annual/vacation -> Paid, casual/personal -> Casual.
 * @param {string} text
 * @returns {'Casual'|'Sick'|'Paid'|null}
 */
const extractLeaveType = (text) => {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const [synonym, canon] of Object.entries(LEAVE_TYPE_SYNONYMS)) {
    const regex = new RegExp(`\\b${synonym}\\b`, 'i');
    if (regex.test(lower)) {
      return canon;
    }
  }
  return null;
};

/**
 * Extract employee identifier (email or name) from text.
 * Admin only feature.
 * @param {string} text
 * @returns {{ email?: string, name?: string }|null}
 */
const extractEmployee = (text) => {
  if (!text) return null;

  // 1. Check for email
  const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
  if (emailMatch) {
    return { email: emailMatch[1].toLowerCase() };
  }

  // 2. Check for "leaves of <Name>" or "<Name>'s leaves"
  const namePatterns = [
    /\bleaves?\s+of\s+([A-Za-z\s]+?)(?:\s+(?:in|for|from|this|last|status)|$)/i,
    /\bshow\s+([A-Za-z\s]+?)(?:'s)?\s+leaves?\b/i,
    /\b([A-Za-z]+)'s\s+leaves?\b/i,
  ];

  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) {
      const rawName = match[1].trim();
      // Exclude common noise words
      const noise = ['my', 'all', 'the', 'their', 'our', 'pending', 'approved', 'rejected'];
      if (!noise.includes(rawName.toLowerCase()) && rawName.length >= 2) {
        return { name: rawName };
      }
    }
  }

  return null;
};

/**
 * Extract list index (e.g. "approve 1", "cancel 2", "1")
 * @param {string} text
 * @returns {number|null}
 */
const extractListIndex = (text) => {
  if (!text) return null;
  const match = text.match(/\b(?:approve|reject|cancel|item|number|#)?\s*(\d{1,3})\b/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
};

/**
 * Extract 24-hex MongoDB ObjectId.
 * @param {string} text
 * @returns {string|null}
 */
const extractLeaveId = (text) => {
  if (!text) return null;
  const match = text.match(/\b([a-f0-9]{24})\b/i);
  return match ? match[1] : null;
};

/**
 * Main entity parser: extracts all typed entities from text.
 * @param {string} text
 * @param {Date} [refDate]
 * @returns {object}
 */
const parseEntities = (text, refDate = new Date()) => {
  const dates = extractDateRange(text, refDate);
  const status = extractStatus(text);
  const department = extractDepartment(text);
  const leaveType = extractLeaveType(text);
  const employee = extractEmployee(text);
  const listIndex = extractListIndex(text);
  const leaveId = extractLeaveId(text);

  return {
    dates,
    status,
    department,
    leaveType,
    employee,
    listIndex,
    leaveId,
  };
};

module.exports = {
  parseEntities,
  parseSingleDate,
  extractDateRange,
  extractStatus,
  extractDepartment,
  extractLeaveType,
  extractEmployee,
  extractListIndex,
  extractLeaveId,
};
