const test = require('node:test');
const assert = require('node:assert');
const { calcWorkingDays } = require('../utils/workingDays');

test('calcWorkingDays - counts standard weekdays correctly', () => {
  // Monday to Friday = 5 days
  const days = calcWorkingDays('2025-06-02', '2025-06-06');
  assert.strictEqual(days, 5);
});

test('calcWorkingDays - skips Saturday and Sunday', () => {
  // Friday to Monday = 2 days (Fri, Mon)
  const days = calcWorkingDays('2025-06-06', '2025-06-09');
  assert.strictEqual(days, 2);
});

test('calcWorkingDays - handles weekend-only selection', () => {
  // Saturday to Sunday = 0 days
  const days = calcWorkingDays('2025-06-07', '2025-06-08');
  assert.strictEqual(days, 0);
});

test('calcWorkingDays - handles half day', () => {
  // Monday half day = 0.5
  const half = calcWorkingDays('2025-06-02', '2025-06-02', true);
  assert.strictEqual(half, 0.5);

  // Monday to Wednesday half day = 3 * 0.5 = 1.5
  const threeHalf = calcWorkingDays('2025-06-02', '2025-06-04', true);
  assert.strictEqual(threeHalf, 1.5);
});

test('calcWorkingDays - handles empty dates', () => {
  assert.strictEqual(calcWorkingDays(null, null), 0);
  assert.strictEqual(calcWorkingDays('', ''), 0);
});
