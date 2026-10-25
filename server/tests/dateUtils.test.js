const test = require('node:test');
const assert = require('node:assert');
const {
  getCalcuttaTodayString,
  getCalcuttaDayBounds,
  getCalcuttaMonthBounds,
  formatDisplayDate,
  formatISODate,
} = require('../utils/dateUtils');

test('dateUtils - getCalcuttaDayBounds produces exact UTC boundaries for 00:00 to 23:59:59.999 IST', () => {
  const bounds = getCalcuttaDayBounds('2026-10-14');

  // 2026-10-14 00:00:00.000 IST is 2026-10-13 18:30:00.000 UTC
  assert.strictEqual(bounds.start.toISOString(), '2026-10-13T18:30:00.000Z');
  // 2026-10-14 23:59:59.999 IST is 2026-10-14 18:29:59.999 UTC
  assert.strictEqual(bounds.end.toISOString(), '2026-10-14T18:29:59.999Z');
  assert.strictEqual(bounds.dateString, '2026-10-14');
});

test('dateUtils - handles midnight transition in Asia/Calcutta correctly', () => {
  // Midnight IST: 2026-10-14 00:00:00 IST = 2026-10-13 18:30:00 UTC
  const midnightRef = new Date('2026-10-13T18:30:00.000Z');
  const todayStr = getCalcuttaTodayString(midnightRef);
  assert.strictEqual(todayStr, '2026-10-14');

  // Just 1 second before midnight IST: 2026-10-13 18:29:59 UTC
  const preMidnightRef = new Date('2026-10-13T18:29:59.000Z');
  const yesterdayStr = getCalcuttaTodayString(preMidnightRef);
  assert.strictEqual(yesterdayStr, '2026-10-13');
});

test('dateUtils - handles month-end boundaries in Asia/Calcutta', () => {
  // End of February in a non-leap year (2025: 28 days)
  const febBounds = getCalcuttaMonthBounds(2025, 2);
  assert.strictEqual(febBounds.start.toISOString(), '2025-01-31T18:30:00.000Z');
  assert.strictEqual(febBounds.end.toISOString(), '2025-02-28T18:29:59.999Z');

  // End of February in a leap year (2028: 29 days)
  const leapBounds = getCalcuttaMonthBounds(2028, 2);
  assert.strictEqual(leapBounds.start.toISOString(), '2028-01-31T18:30:00.000Z');
  assert.strictEqual(leapBounds.end.toISOString(), '2028-02-29T18:29:59.999Z');

  // End of October (31 days)
  const octBounds = getCalcuttaMonthBounds(2026, 10);
  assert.strictEqual(octBounds.start.toISOString(), '2026-09-30T18:30:00.000Z');
  assert.strictEqual(octBounds.end.toISOString(), '2026-10-31T18:29:59.999Z');
});

test('dateUtils - formats display date as "20 Oct 2026"', () => {
  const d = new Date('2026-10-20T10:00:00.000Z');
  const display = formatDisplayDate(d);
  assert.strictEqual(display, '20 Oct 2026');

  const iso = formatISODate(d);
  assert.strictEqual(iso, '2026-10-20');
});
