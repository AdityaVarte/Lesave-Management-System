/**
 * Date utilities enforcing Asia/Calcutta (UTC+05:30) timezone boundaries
 * while storing and comparing in UTC.
 */

const TIMEZONE = 'Asia/Kolkata'; // Official IANA name for Asia/Calcutta in V8/Node.js

/**
 * Returns today's date formatted as 'YYYY-MM-DD' in Asia/Calcutta timezone.
 * @param {Date} [refDate=new Date()]
 * @returns {string} e.g. "2026-10-14"
 */
const getCalcuttaTodayString = (refDate = new Date()) => {
  return refDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
};

/**
 * Parses a YYYY-MM-DD string or Date into start and end of that day in Asia/Calcutta.
 * Returned Date objects represent exact UTC timestamps for 00:00:00.000 and 23:59:59.999 IST.
 * 
 * @param {string|Date} dateInput - 'YYYY-MM-DD' string or Date object
 * @returns {{ start: Date, end: Date, dateString: string }}
 */
const getCalcuttaDayBounds = (dateInput) => {
  let dateStr;
  if (dateInput instanceof Date) {
    dateStr = getCalcuttaTodayString(dateInput);
  } else if (typeof dateInput === 'string') {
    dateStr = dateInput.trim().slice(0, 10);
  } else {
    dateStr = getCalcuttaTodayString();
  }

  // Exact boundaries in Asia/Calcutta (+05:30)
  const start = new Date(`${dateStr}T00:00:00.000+05:30`);
  const end = new Date(`${dateStr}T23:59:59.999+05:30`);

  return { start, end, dateString: dateStr };
};

/**
 * Computes the start and end of a given month in Asia/Calcutta as UTC Dates.
 * @param {number} year e.g. 2026
 * @param {number} month 1 to 12
 * @returns {{ start: Date, end: Date, monthString: string }}
 */
const getCalcuttaMonthBounds = (year, month) => {
  const m = Number(month);
  const y = Number(year);
  const padMonth = String(m).padStart(2, '0');
  const lastDay = new Date(y, m, 0).getDate();
  const padDay = String(lastDay).padStart(2, '0');

  const start = new Date(`${y}-${padMonth}-01T00:00:00.000+05:30`);
  const end = new Date(`${y}-${padMonth}-${padDay}T23:59:59.999+05:30`);

  return {
    start,
    end,
    monthString: `${y}-${padMonth}`,
  };
};

/**
 * Formats a Date or date string for user display: "20 Oct 2026" in Asia/Calcutta.
 * @param {Date|string} date
 * @returns {string}
 */
const formatDisplayDate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  });
};

/**
 * Formats a Date or date string as standard YYYY-MM-DD in Asia/Calcutta.
 * @param {Date|string} date
 * @returns {string}
 */
const formatISODate = (date) => {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
};

/**
 * Returns today's date formatted with weekday: "Wednesday, 14 Oct 2026" in Asia/Calcutta.
 * @param {Date} [refDate=new Date()]
 * @returns {string}
 */
const getCalcuttaTodayWithWeekday = (refDate = new Date()) => {
  return refDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  });
};

module.exports = {
  TIMEZONE,
  getCalcuttaTodayString,
  getCalcuttaTodayWithWeekday,
  getCalcuttaDayBounds,
  getCalcuttaMonthBounds,
  formatDisplayDate,
  formatISODate,
};
