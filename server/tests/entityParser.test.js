const test = require('node:test');
const assert = require('node:assert');
const {
  parseSingleDate,
  extractDateRange,
  extractStatus,
  extractDepartment,
  extractLeaveType,
  extractEmployee,
  extractListIndex,
  extractLeaveId,
} = require('../services/entityParser');

// Fixed reference date: Wednesday, 2026-10-14 12:00:00 IST
const REF_DATE = new Date('2026-10-14T06:30:00.000Z');

// ─── 1. Date Parser: Relative Single Days ──────────────────────────────────────
test('dateParser - parses "today", "tomorrow", "yesterday"', () => {
  assert.strictEqual(parseSingleDate('today', REF_DATE), '2026-10-14');
  assert.strictEqual(parseSingleDate('tomorrow', REF_DATE), '2026-10-15');
  assert.strictEqual(parseSingleDate('yesterday', REF_DATE), '2026-10-13');
});

// ─── 2. Date Parser: Weekdays (this friday, next monday) ───────────────────────
test('dateParser - parses "this friday" and "next monday"', () => {
  // From Wed 2026-10-14: Friday is 2 days ahead -> 2026-10-16
  assert.strictEqual(parseSingleDate('this friday', REF_DATE), '2026-10-16');
  // Next Monday is 5 days ahead -> 2026-10-19
  assert.strictEqual(parseSingleDate('next monday', REF_DATE), '2026-10-19');
});

// ─── 3. Date Parser: Formats (20 oct, 20/10/2026, 2026-10-20) ─────────────────
test('dateParser - parses explicit date formats', () => {
  assert.strictEqual(parseSingleDate('20 oct', REF_DATE), '2026-10-20');
  assert.strictEqual(parseSingleDate('20 october', REF_DATE), '2026-10-20');
  assert.strictEqual(parseSingleDate('20 oct 2026', REF_DATE), '2026-10-20');
  assert.strictEqual(parseSingleDate('20/10/2026', REF_DATE), '2026-10-20');
  assert.strictEqual(parseSingleDate('2026-10-20', REF_DATE), '2026-10-20');
});

// ─── 4. Date Parser: Month Ends and Leap Year ──────────────────────────────────
test('dateParser - handles month-ends and leap year validation', () => {
  // Non-leap year Feb: 28 days valid, 29 days invalid
  assert.strictEqual(parseSingleDate('28 feb 2025', REF_DATE), '2025-02-28');
  assert.strictEqual(parseSingleDate('29 feb 2025', REF_DATE), null);

  // Leap year Feb (2028): 29 days valid, 30 days invalid
  assert.strictEqual(parseSingleDate('29 feb 2028', REF_DATE), '2028-02-29');
  assert.strictEqual(parseSingleDate('30 feb 2028', REF_DATE), null);

  // 31-day month end (October)
  assert.strictEqual(parseSingleDate('31 oct 2026', REF_DATE), '2026-10-31');
  assert.strictEqual(parseSingleDate('32 oct 2026', REF_DATE), null);

  // 30-day month end (September)
  assert.strictEqual(parseSingleDate('30 sep 2026', REF_DATE), '2026-09-30');
  assert.strictEqual(parseSingleDate('31 sep 2026', REF_DATE), null);
});

// ─── 5. Date Ranges: from X to Y ──────────────────────────────────────────────
test('dateParser - extracts date range "from 20 oct to 22 oct"', () => {
  const res = extractDateRange('apply sick leave from 20 oct to 22 oct', REF_DATE);
  assert.ok(res);
  assert.strictEqual(res.from, '2026-10-20');
  assert.strictEqual(res.to, '2026-10-22');
  assert.strictEqual(res.fromDisplay, '20 Oct 2026');
  assert.strictEqual(res.toDisplay, '22 Oct 2026');
});

test('dateParser - extracts date range "20/10/2026 to 22/10/2026"', () => {
  const res = extractDateRange('take leave 20/10/2026 to 22/10/2026', REF_DATE);
  assert.ok(res);
  assert.strictEqual(res.from, '2026-10-20');
  assert.strictEqual(res.to, '2026-10-22');
});

// ─── 6. Relative Periods: this week, last month, september, q3 ────────────────
test('dateParser - extracts "this week"', () => {
  // Wed 2026-10-14 -> Monday 2026-10-12 to Sunday 2026-10-18
  const res = extractDateRange('who is on leave this week', REF_DATE);
  assert.ok(res);
  assert.strictEqual(res.from, '2026-10-12');
  assert.strictEqual(res.to, '2026-10-18');
});

test('dateParser - extracts "last month"', () => {
  // Ref is Oct 2026 -> Last month is Sep 2026 (1 to 30)
  const res = extractDateRange('leaves taken last month', REF_DATE);
  assert.ok(res);
  assert.strictEqual(res.from, '2026-09-01');
  assert.strictEqual(res.to, '2026-09-30');
});

test('dateParser - extracts named month "in september"', () => {
  const res = extractDateRange('my approved leaves in september', REF_DATE);
  assert.ok(res);
  assert.strictEqual(res.from, '2026-09-01');
  assert.strictEqual(res.to, '2026-09-30');
});

test('dateParser - extracts quarter "q3"', () => {
  const res = extractDateRange('show leaves in q3', REF_DATE);
  assert.ok(res);
  assert.strictEqual(res.from, '2026-07-01');
  assert.strictEqual(res.to, '2026-09-30');
});

// ─── 7. Status, Department, Leave Types & Synonyms ─────────────────────────────
test('entityParser - extracts status', () => {
  assert.strictEqual(extractStatus('show my pending leaves'), 'Pending');
  assert.strictEqual(extractStatus('all approved requests'), 'Approved');
  assert.strictEqual(extractStatus('any rejected applications'), 'Rejected');
  assert.strictEqual(extractStatus('hello how are you'), null);
});

test('entityParser - extracts department', () => {
  assert.strictEqual(extractDepartment('leaves in engineering'), 'Engineering');
  assert.strictEqual(extractDepartment('show design department summary'), 'Design');
  assert.strictEqual(extractDepartment('finance team leaves'), 'Finance');
  assert.strictEqual(extractDepartment('hr team leaves'), 'HR');
  assert.strictEqual(extractDepartment('marketing department'), 'Marketing');
  assert.strictEqual(extractDepartment('operations stats'), 'Operations');
  assert.strictEqual(extractDepartment('general question'), null);
});

test('entityParser - extracts leave type with synonyms', () => {
  assert.strictEqual(extractLeaveType('apply sick leave'), 'Sick');
  assert.strictEqual(extractLeaveType('need medical leave'), 'Sick');
  assert.strictEqual(extractLeaveType('doctor appointment'), 'Sick');
  assert.strictEqual(extractLeaveType('take casual leave'), 'Casual');
  assert.strictEqual(extractLeaveType('personal time off'), 'Casual');
  assert.strictEqual(extractLeaveType('apply paid leave'), 'Paid');
  assert.strictEqual(extractLeaveType('earned leave balance'), 'Paid');
  assert.strictEqual(extractLeaveType('annual leave policy'), 'Paid');
  assert.strictEqual(extractLeaveType('vacation request'), 'Paid');
  assert.strictEqual(extractLeaveType('regular message'), null);
});

// ─── 8. Employee, List Index, Leave ID ─────────────────────────────────────────
test('entityParser - extracts employee email and name', () => {
  const emailRes = extractEmployee('leaves of rohan@company.com');
  assert.strictEqual(emailRes.email, 'rohan@company.com');

  const nameRes = extractEmployee("show Priya's leaves");
  assert.strictEqual(nameRes.name, 'Priya');

  const nameOfRes = extractEmployee('leaves of Rohan Sharma');
  assert.strictEqual(nameOfRes.name, 'Rohan Sharma');
});

test('entityParser - extracts list index and leave ID', () => {
  assert.strictEqual(extractListIndex('approve 1'), 1);
  assert.strictEqual(extractListIndex('cancel 2'), 2);
  assert.strictEqual(extractListIndex('item 3'), 3);
  assert.strictEqual(extractListIndex('no numbers here'), null);

  const hex = '6630f9a234f9a234f9a23401';
  assert.strictEqual(extractLeaveId(`approve leave ${hex}`), hex);
  assert.strictEqual(extractLeaveId('no id here'), null);
});
