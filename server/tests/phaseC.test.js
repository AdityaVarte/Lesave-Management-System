const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Employee = require('../models/Employee');
const LeaveType = require('../models/LeaveType');
const LeaveRequest = require('../models/LeaveRequest');
const pendingActions = require('../services/pendingActions');
const slotFilling = require('../services/slotFilling');
const intentHandlers = require('../services/intentHandlers');
const { storeUserList, getUserList } = require('../services/intentEngine');
const dataService = require('../services/dataService');
const chatController = require('../controllers/chatController');

let mongod;
let adminUser;
let rohanEmp;
let priyaEmp;
let casualType;
let sickType;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  casualType = await LeaveType.create({
    type_name: 'Casual',
    max_days_per_request: 10,
    color: '#E4B84D',
  });
  sickType = await LeaveType.create({
    type_name: 'Sick',
    max_days_per_request: 15,
    color: '#E07070',
  });

  adminUser = await Employee.create({
    name: 'Admin Manager',
    email: 'admin.manager@company.com',
    department: 'HR',
    role: 'admin',
    total_leaves: 20,
    password: 'password123',
  });

  rohanEmp = await Employee.create({
    name: 'Rohan Sharma',
    email: 'rohan.sharma@company.com',
    department: 'Engineering',
    role: 'employee',
    total_leaves: 20,
    password: 'password123',
  });

  priyaEmp = await Employee.create({
    name: 'Priya Mehta',
    email: 'priya.mehta@company.com',
    department: 'Design',
    role: 'employee',
    total_leaves: 20,
    password: 'password123',
  });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// Helper to mock express req/res
const createMockReqRes = (user, body) => {
  const req = { user, body };
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
  return { req, res };
};

// ─── 1. PENDING ACTIONS LIFECYCLE TESTS ─────────────────────────────────────

test('pendingActions - creates action with UUID, user binding, and 5-min TTL', () => {
  const action = pendingActions.createPendingAction({
    userId: rohanEmp._id,
    tool: 'apply_leave',
    args: { reason: 'Test' },
    summary: '• Test Summary',
  });

  assert.ok(action.id);
  assert.strictEqual(action.tool, 'apply_leave');
  assert.strictEqual(action.summary, '• Test Summary');
  assert.ok(action.expiresAt > Date.now());
  assert.ok(action.expiresAt <= Date.now() + 5 * 60 * 1000);
});

test('pendingActions - consumePendingAction is single-use and deletes after first consume', () => {
  const action = pendingActions.createPendingAction({
    userId: rohanEmp._id,
    tool: 'cancel_leave',
    args: { leaveId: '123' },
    summary: '• Cancel',
  });

  const firstConsume = pendingActions.consumePendingAction(action.id, rohanEmp);
  assert.ok(firstConsume.action);
  assert.strictEqual(firstConsume.action.id, action.id);

  const secondConsume = pendingActions.consumePendingAction(action.id, rohanEmp);
  assert.strictEqual(secondConsume.status, 404);
  assert.ok(secondConsume.error.includes('already been executed or does not exist'));
});

test('pendingActions - rejects consumption by a foreign user with 403', () => {
  const action = pendingActions.createPendingAction({
    userId: rohanEmp._id,
    tool: 'cancel_leave',
    args: { leaveId: '123' },
    summary: '• Cancel',
  });

  const foreignConsume = pendingActions.consumePendingAction(action.id, priyaEmp);
  assert.strictEqual(foreignConsume.status, 403);
  assert.ok(foreignConsume.error.includes('Access denied'));
});

test('pendingActions - rejects expired action with 410', () => {
  const action = pendingActions.createPendingAction({
    userId: rohanEmp._id,
    tool: 'apply_leave',
    args: { reason: 'Test' },
    summary: '• Expired',
  });

  // Manually expire action
  const stored = pendingActions._pendingActionsMap.get(action.id);
  stored.expiresAt = Date.now() - 1000;

  const expiredConsume = pendingActions.consumePendingAction(action.id, rohanEmp);
  assert.strictEqual(expiredConsume.status, 410);
  assert.ok(expiredConsume.error.includes('expired (5-minute limit)'));
});

test('pendingActions - discardPendingAction cancels action only by owner', () => {
  const action = pendingActions.createPendingAction({
    userId: rohanEmp._id,
    tool: 'apply_leave',
    args: { reason: 'Test' },
    summary: '• Discard test',
  });

  // Foreign user cannot discard
  const foreignDiscard = pendingActions.discardPendingAction(action.id, priyaEmp._id);
  assert.strictEqual(foreignDiscard, false);

  // Owner can discard
  const ownerDiscard = pendingActions.discardPendingAction(action.id, rohanEmp._id);
  assert.strictEqual(ownerDiscard, true);

  // Subsequent consume fails
  const consumeAfterDiscard = pendingActions.consumePendingAction(action.id, rohanEmp);
  assert.strictEqual(consumeAfterDiscard.status, 404);
});

// ─── 2. SLOT FILLING PROGRESSION & CANCELLATION TESTS ────────────────────────

test('slotFilling - getNextMissingApplySlot identifies leaveType if empty', () => {
  const missing = slotFilling.getNextMissingApplySlot({});
  assert.strictEqual(missing, 'leaveType');
  const prompt = slotFilling.getPromptForSlot(missing, {});
  assert.ok(prompt.includes('Which type of leave'));
});

test('slotFilling - asks for date range when leave type is provided', async () => {
  slotFilling.clearSlotState(rohanEmp._id);
  const state = {
    intent: 'APPLY_LEAVE',
    slots: {},
  };
  slotFilling.setSlotState(rohanEmp._id, state);

  const res = await slotFilling.processApplySlotFilling(rohanEmp, 'casual', state);
  assert.strictEqual(res.complete, false);
  assert.ok(res.reply.includes('date range'));
});

test('slotFilling - single date input sets both start and end date', async () => {
  slotFilling.clearSlotState(rohanEmp._id);
  const state = {
    intent: 'APPLY_LEAVE',
    slots: { leaveType: 'Casual' },
  };
  slotFilling.setSlotState(rohanEmp._id, state);

  const res = await slotFilling.processApplySlotFilling(rohanEmp, '2026-11-16', state);
  assert.strictEqual(res.complete, false);
  const updated = slotFilling.getSlotState(rohanEmp._id);
  assert.strictEqual(updated.slots.startDate, '2026-11-16');
  assert.strictEqual(updated.slots.endDate, '2026-11-16');
  assert.ok(res.reply.includes('reason'));
});

test('slotFilling - rejects past date and re-prompts for dates', async () => {
  slotFilling.clearSlotState(rohanEmp._id);
  const state = {
    intent: 'APPLY_LEAVE',
    slots: { leaveType: 'Casual' },
  };
  slotFilling.setSlotState(rohanEmp._id, state);

  const res = await slotFilling.processApplySlotFilling(rohanEmp, '2020-01-01', state);
  assert.strictEqual(res.complete, false);
  assert.ok(res.reply.includes('past'));
});

test('slotFilling - rejects reason shorter than 10 characters and re-prompts', async () => {
  slotFilling.clearSlotState(rohanEmp._id);
  const state = {
    intent: 'APPLY_LEAVE',
    slots: {
      leaveType: 'Casual',
      startDate: '2026-11-16',
      endDate: '2026-11-17',
    },
  };
  slotFilling.setSlotState(rohanEmp._id, state);

  const res = await slotFilling.processApplySlotFilling(rohanEmp, 'vacation', state);
  assert.strictEqual(res.complete, false);
  assert.ok(res.reply.includes('at least 10 characters'));
});

test('slotFilling - completes when all slots are valid', async () => {
  slotFilling.clearSlotState(rohanEmp._id);
  const state = {
    intent: 'APPLY_LEAVE',
    slots: {
      leaveType: 'Casual',
      startDate: '2026-11-16',
      endDate: '2026-11-17',
    },
    createdAt: Date.now(),
  };

  const res = await slotFilling.processApplySlotFilling(
    rohanEmp,
    'Attending family wedding ceremony',
    state
  );
  assert.strictEqual(res.complete, true);
  assert.strictEqual(res.slots.leaveType, 'Casual');
  assert.strictEqual(res.slots.startDate, '2026-11-16');
  assert.strictEqual(res.slots.endDate, '2026-11-17');
  assert.strictEqual(res.slots.reason, 'Attending family wedding ceremony');
});

test('slotFilling - drops state on cancellation words ("cancel", "never mind", "stop")', () => {
  slotFilling.setSlotState(rohanEmp._id, { intent: 'APPLY_LEAVE', slots: {} });
  assert.ok(slotFilling.getSlotState(rohanEmp._id));

  const shouldDrop = slotFilling.isCancelMessage('never mind');
  assert.strictEqual(shouldDrop, true);

  slotFilling.clearSlotState(rohanEmp._id);
  assert.strictEqual(slotFilling.getSlotState(rohanEmp._id), null);
});

test('slotFilling - drops state automatically after 5-minute TTL', () => {
  slotFilling.setSlotState(rohanEmp._id, { intent: 'APPLY_LEAVE', slots: {} });
  const stored = slotFilling.getSlotState(rohanEmp._id);
  assert.ok(stored);
  stored.timestamp = Date.now() - (6 * 60 * 1000); // Expire beyond 5 min

  const state = slotFilling.getSlotState(rohanEmp._id);
  assert.strictEqual(state, null);
});

// ─── 3. HANDLERS AND RULES TESTS ───────────────────────────────────────────

test('intentHandlers - BULK_REFUSAL refuses bulk operations with polite message', () => {
  const reply = intentHandlers.handleBulkRefusal();
  assert.ok(reply.includes('Bulk actions are not supported'));
  assert.ok(reply.includes('one at a time'));
});

test('intentHandlers - handleApplyLeave with all slots directly generates pendingAction card', async () => {
  const result = await intentHandlers.handleApplyLeave(
    rohanEmp,
    {
      leaveType: 'Casual',
      dates: { from: '2026-11-16', to: '2026-11-18' },
    },
    'apply casual leave from 2026-11-16 to 2026-11-18 because attending family wedding ceremony'
  );

  assert.ok(result.pendingAction);
  assert.strictEqual(result.pendingAction.tool, 'apply_leave');
  assert.ok(result.pendingAction.summary.includes('Casual Leave'));
  assert.ok(result.pendingAction.summary.includes('3 days'));
  assert.ok(result.reply.includes('review and confirm'));
});

test('intentHandlers - handleCancelLeave with listIndex resolves against user list', async () => {
  const dummyLeave = await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: casualType._id, type_name: 'Casual' },
    start_date: new Date('2026-12-01T00:00:00.000Z'),
    end_date: new Date('2026-12-02T23:59:59.999Z'),
    reason: 'Personal vacation in December',
    status: 'Pending',
    working_days: 2,
  });

  storeUserList(rohanEmp._id, [dummyLeave]);

  const result = await intentHandlers.handleCancelLeave(rohanEmp, { listIndex: 1 });
  assert.ok(result.pendingAction);
  assert.strictEqual(result.pendingAction.tool, 'cancel_leave');
  assert.strictEqual(result.pendingAction.args.leaveId, dummyLeave._id.toString());
  assert.ok(result.pendingAction.summary.includes('Personal vacation in December'));
});

test('intentHandlers - handleCancelLeave without active list context prompts user', async () => {
  // Ensure a pending leave exists
  await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: casualType._id, type_name: 'Casual' },
    start_date: new Date('2026-12-22T00:00:00.000Z'),
    end_date: new Date('2026-12-23T23:59:59.999Z'),
    reason: 'Pending leave for cancel prompt test',
    status: 'Pending',
    working_days: 2,
  });

  // Clear list context
  storeUserList(rohanEmp._id, []);

  const reply = await intentHandlers.handleCancelLeave(rohanEmp, { listIndex: 1 });
  assert.ok(reply.includes('show my pending leaves') || reply.includes('show my leaves'));
});

test('intentHandlers - handleApprove rejects non-admin with clear message', async () => {
  const reply = await intentHandlers.handleApprove(rohanEmp, { listIndex: 1 });
  assert.ok(reply.includes('Only administrators'));
});

test('intentHandlers - handleApprove checks balance impact and warns if balance becomes negative', async () => {
  const lowBalanceEmp = await Employee.create({
    name: 'Low Balance Employee',
    email: 'low.impact@company.com',
    department: 'Engineering',
    role: 'employee',
    total_leaves: 2,
    password: 'password123',
  });

  const bigLeave = await LeaveRequest.create({
    employee_ref: lowBalanceEmp._id,
    employee_snapshot: { name: lowBalanceEmp.name, email: lowBalanceEmp.email, department: lowBalanceEmp.department },
    leave_type: { type_id: casualType._id, type_name: 'Casual' },
    start_date: new Date('2026-12-14T00:00:00.000Z'),
    end_date: new Date('2026-12-18T23:59:59.999Z'), // Mon to Fri = 5 days > 2
    reason: 'Trip home for family celebration',
    status: 'Pending',
  });

  storeUserList(adminUser._id, [bigLeave]);

  const result = await intentHandlers.handleApprove(adminUser, { listIndex: 1 });
  assert.ok(result.pendingAction);
  assert.strictEqual(result.pendingAction.tool, 'approve_leave');
  assert.ok(result.pendingAction.summary.includes('Warning'));
  assert.ok(result.pendingAction.summary.includes('reduce Low Balance Employee\'s available balance'));
});

test('intentHandlers - handleReject prompts for reason if not provided in message', async () => {
  const pendingLeave = await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: casualType._id, type_name: 'Casual' },
    start_date: new Date('2026-12-05T00:00:00.000Z'),
    end_date: new Date('2026-12-06T23:59:59.999Z'),
    reason: 'Short weekend trip extension',
    status: 'Pending',
    working_days: 2,
  });

  storeUserList(adminUser._id, [pendingLeave]);

  const reply = await intentHandlers.handleReject(adminUser, { listIndex: 1 }, 'reject 1');
  assert.ok(reply.includes('Please provide a reason for rejecting'));

  const slotState = slotFilling.getSlotState(adminUser._id);
  assert.ok(slotState);
  assert.strictEqual(slotState.intent, 'REJECT');
  assert.strictEqual(slotState.slots.leaveId, pendingLeave._id.toString());
});

// ─── 4. FULL CHATBOT CONTROLLER & CONFIRM INTEGRATION TESTS ────────────────

test('chatController.postChat - interactive multi-step slot filling flow for APPLY_LEAVE', async () => {
  slotFilling.clearSlotState(rohanEmp._id);

  // Step 1: User says "apply leave"
  const step1 = createMockReqRes(rohanEmp, { message: 'apply leave', history: [] });
  await chatController.postChat(step1.req, step1.res);
  assert.strictEqual(step1.res.data.source, 'rules');
  assert.ok(step1.res.data.reply.includes('Which type of leave'));
  assert.strictEqual(step1.res.data.pendingAction, null);

  // Step 2: User says "casual"
  const step2 = createMockReqRes(rohanEmp, { message: 'casual', history: [] });
  await chatController.postChat(step2.req, step2.res);
  assert.strictEqual(step2.res.data.source, 'rules');
  assert.ok(step2.res.data.reply.includes('date range'));
  assert.strictEqual(step2.res.data.pendingAction, null);
  assert.strictEqual(step2.res.data.pendingAction, null);

  // Step 3: User says "2026-11-23 to 2026-11-25"
  const step3 = createMockReqRes(rohanEmp, { message: '2026-11-23 to 2026-11-25', history: [] });
  await chatController.postChat(step3.req, step3.res);
  assert.strictEqual(step3.res.data.source, 'rules');
  assert.ok(step3.res.data.reply.includes('reason'));
  assert.strictEqual(step3.res.data.pendingAction, null);

  // Step 4: User gives valid reason
  const step4 = createMockReqRes(rohanEmp, {
    message: 'Attending annual family festival ceremony',
    history: [],
  });
  await chatController.postChat(step4.req, step4.res);
  assert.strictEqual(step4.res.data.source, 'rules');
  assert.ok(step4.res.data.reply.includes('review and confirm'));
  assert.ok(step4.res.data.pendingAction);
  assert.strictEqual(step4.res.data.pendingAction.tool, 'apply_leave');
  assert.strictEqual(step4.res.data.pendingAction.args.leave_type_name, 'Casual');

  // Verify slot state is cleared after completion
  assert.strictEqual(slotFilling.getSlotState(rohanEmp._id), null);
});

test('chatController.postChat - user drops slot filling by saying "cancel"', async () => {
  slotFilling.clearSlotState(rohanEmp._id);

  // Start apply flow
  const step1 = createMockReqRes(rohanEmp, { message: 'apply leave', history: [] });
  await chatController.postChat(step1.req, step1.res);
  assert.ok(slotFilling.getSlotState(rohanEmp._id));

  // User cancels
  const step2 = createMockReqRes(rohanEmp, { message: 'cancel', history: [] });
  await chatController.postChat(step2.req, step2.res);
  assert.ok(step2.res.data.reply.includes('cancelled'));
  assert.strictEqual(slotFilling.getSlotState(rohanEmp._id), null);
});

test('chatController.postChat - mid-flow unrelated intent drops draft and answers new query', async () => {
  slotFilling.clearSlotState(rohanEmp._id);

  // Start apply flow
  const step1 = createMockReqRes(rohanEmp, { message: 'apply leave', history: [] });
  await chatController.postChat(step1.req, step1.res);

  // User asks balance mid-flow
  const step2 = createMockReqRes(rohanEmp, { message: 'what is my leave balance?', history: [] });
  await chatController.postChat(step2.req, step2.res);
  assert.strictEqual(step2.res.data.source, 'rules');
  assert.ok(step2.res.data.reply.includes('Your Leave Balance:'));
  assert.strictEqual(slotFilling.getSlotState(rohanEmp._id), null);
});

test('chatController.postChat - while APPLY_LEAVE is active, "cancel my pending leave" drops draft and runs CANCEL_LEAVE', async () => {
  slotFilling.clearSlotState(rohanEmp._id);
  await LeaveRequest.deleteMany({ employee_ref: rohanEmp._id, status: 'Pending' });

  // Seed 1 single pending leave for Rohan so CANCEL_LEAVE generates pendingAction directly
  const pendingLeave = await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: casualType._id, type_name: 'Casual' },
    start_date: new Date('2026-12-28T00:00:00.000Z'),
    end_date: new Date('2026-12-29T23:59:59.999Z'),
    reason: 'Year end celebration leave',
    status: 'Pending',
    working_days: 2,
  });

  // Start apply flow
  const step1 = createMockReqRes(rohanEmp, { message: 'apply leave', history: [] });
  await chatController.postChat(step1.req, step1.res);
  assert.ok(slotFilling.getSlotState(rohanEmp._id));

  // User types "cancel my pending leave"
  const step2 = createMockReqRes(rohanEmp, { message: 'cancel my pending leave', history: [] });
  await chatController.postChat(step2.req, step2.res);

  // Draft should be dropped
  assert.strictEqual(slotFilling.getSlotState(rohanEmp._id), null);
  assert.strictEqual(step2.res.data.source, 'rules');
  // Message must inform user that draft was dropped
  assert.ok(step2.res.data.reply.includes('Draft application cancelled'));
  // And CANCEL_LEAVE confirmation card must be generated
  assert.ok(step2.res.data.pendingAction);
  assert.strictEqual(step2.res.data.pendingAction.tool, 'cancel_leave');
  assert.strictEqual(step2.res.data.pendingAction.args.leaveId, pendingLeave._id.toString());
});

test('chatController.confirmAction - confirm decision applies leave and triggers refresh', async () => {
  const pendingAction = pendingActions.createPendingAction({
    userId: rohanEmp._id,
    tool: 'apply_leave',
    args: {
      leave_type_name: 'Casual',
      start_date: '2026-11-23',
      end_date: '2026-11-25',
      reason: 'Attending annual family festival ceremony',
      is_half_day: false,
    },
    summary: '• Casual Leave',
  });

  const { req, res } = createMockReqRes(rohanEmp, {
    actionId: pendingAction.id,
    decision: 'confirm',
  });

  await chatController.confirmAction(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(res.data.refreshData, true);
  assert.ok(res.data.reply.includes('successfully submitted'));

  // Verify in MongoDB
  const created = await LeaveRequest.findOne({
    employee_ref: rohanEmp._id,
    reason: 'Attending annual family festival ceremony',
  });
  assert.ok(created);
  assert.strictEqual(created.status, 'Pending');
  assert.strictEqual(created.working_days, 3);
});

test('chatController.confirmAction - cancel decision drops action without executing', async () => {
  const pendingAction = pendingActions.createPendingAction({
    userId: rohanEmp._id,
    tool: 'apply_leave',
    args: {
      leave_type_name: 'Casual',
      start_date: '2026-12-01',
      end_date: '2026-12-02',
      reason: 'Cancelled test request',
    },
    summary: '• Cancelled test',
  });

  const { req, res } = createMockReqRes(rohanEmp, {
    actionId: pendingAction.id,
    decision: 'cancel',
  });

  await chatController.confirmAction(req, res);
  assert.strictEqual(res.statusCode, 200);
  assert.ok(res.data.reply.includes('Action cancelled'));

  // Action is removed
  const reConsume = pendingActions.consumePendingAction(pendingAction.id, rohanEmp);
  assert.strictEqual(reConsume.status, 404);

  // DB was NOT modified
  const notCreated = await LeaveRequest.findOne({ reason: 'Cancelled test request' });
  assert.strictEqual(notCreated, null);
});

test('chatController.confirmAction - atomic double-approve / double-consume race fails safely', async () => {
  const pendingLeave = await LeaveRequest.create({
    employee_ref: priyaEmp._id,
    employee_snapshot: { name: priyaEmp.name, email: priyaEmp.email, department: priyaEmp.department },
    leave_type: { type_id: casualType._id, type_name: 'Casual' },
    start_date: new Date('2026-12-08T00:00:00.000Z'),
    end_date: new Date('2026-12-09T23:59:59.999Z'),
    reason: 'Family visit during winter',
    status: 'Pending',
    working_days: 2,
  });

  const pendingAction = pendingActions.createPendingAction({
    userId: adminUser._id,
    tool: 'approve_leave',
    args: { leaveId: pendingLeave._id.toString() },
    summary: '• Approve Priya Leave',
  });

  // First confirm succeeds
  const run1 = createMockReqRes(adminUser, {
    actionId: pendingAction.id,
    decision: 'confirm',
  });
  await chatController.confirmAction(run1.req, run1.res);
  assert.strictEqual(run1.res.statusCode, 200);
  assert.strictEqual(run1.res.data.refreshData, true);

  // Second confirm fails because action was already consumed
  const run2 = createMockReqRes(adminUser, {
    actionId: pendingAction.id,
    decision: 'confirm',
  });
  await chatController.confirmAction(run2.req, run2.res);
  assert.strictEqual(run2.res.statusCode, 404);
  assert.ok(run2.res.data.message.includes('already been executed'));
});

test('chatController.confirmAction - re-check verification at confirm blocks approving already approved leave', async () => {
  const alreadyApprovedLeave = await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: casualType._id, type_name: 'Casual' },
    start_date: new Date('2026-12-15T00:00:00.000Z'),
    end_date: new Date('2026-12-16T23:59:59.999Z'),
    reason: 'Trip to home town',
    status: 'Approved',
    working_days: 2,
  });

  const pendingAction = pendingActions.createPendingAction({
    userId: adminUser._id,
    tool: 'approve_leave',
    args: { leaveId: alreadyApprovedLeave._id.toString() },
    summary: '• Stale approve action',
  });

  const { req, res } = createMockReqRes(adminUser, {
    actionId: pendingAction.id,
    decision: 'confirm',
  });

  await chatController.confirmAction(req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.ok(res.data.message.includes('no longer pending'));
});

test('chatController.confirmAction - re-check verification blocks non-admin from approving', async () => {
  const pendingLeave = await LeaveRequest.create({
    employee_ref: priyaEmp._id,
    employee_snapshot: { name: priyaEmp.name, email: priyaEmp.email, department: priyaEmp.department },
    leave_type: { type_id: casualType._id, type_name: 'Casual' },
    start_date: new Date('2026-12-20T00:00:00.000Z'),
    end_date: new Date('2026-12-21T23:59:59.999Z'),
    reason: 'Winter festival break',
    status: 'Pending',
    working_days: 2,
  });

  // Action assigned to employee (security violation test)
  const pendingAction = pendingActions.createPendingAction({
    userId: rohanEmp._id,
    tool: 'approve_leave',
    args: { leaveId: pendingLeave._id.toString() },
    summary: '• Rogue approve',
  });

  const { req, res } = createMockReqRes(rohanEmp, {
    actionId: pendingAction.id,
    decision: 'confirm',
  });

  await chatController.confirmAction(req, res);
  assert.strictEqual(res.statusCode, 403);
  assert.ok(res.data.message.includes('Admin permission required'));
});

// ─── 5. BUSINESS RULE VALIDATION TESTS ─────────────────────────────────────

test('business rules - zero working days (weekends only) rejected on apply', async () => {
  // Saturday to Sunday: 2026-11-21 to 2026-11-22
  await assert.rejects(
    dataService.applyLeave(rohanEmp, {
      leave_type_name: 'Casual',
      start_date: '2026-11-21',
      end_date: '2026-11-22',
      reason: 'Weekend only leave attempt',
    }),
    /0 working days/
  );
});

test('business rules - exceeding max_days_per_request rejected on apply', async () => {
  // Casual max is 10 days; request 12 working days
  await assert.rejects(
    dataService.applyLeave(rohanEmp, {
      leave_type_name: 'Casual',
      start_date: '2026-11-02',
      end_date: '2026-11-17',
      reason: 'Long break exceeding maximum request limit',
    }),
    /cannot exceed 10 working days/
  );
});

test('business rules - overlapping leave request rejected on apply', async () => {
  // Seed initial leave
  await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: casualType._id, type_name: 'Casual' },
    start_date: new Date('2026-11-30T00:00:00.000Z'),
    end_date: new Date('2026-12-04T23:59:59.999Z'),
    reason: 'Initial existing leave',
    status: 'Pending',
    working_days: 5,
  });

  // Attempt overlapping request
  await assert.rejects(
    dataService.applyLeave(rohanEmp, {
      leave_type_name: 'Casual',
      start_date: '2026-12-02',
      end_date: '2026-12-05',
      reason: 'Overlapping request attempt',
    }),
    /Leave dates overlap with an existing/
  );
});

test('business rules - insufficient leave balance rejected on apply', async () => {
  // Employee with low balance
  const lowBalanceEmp = await Employee.create({
    name: 'Low Balance User',
    email: 'low.balance@company.com',
    department: 'Finance',
    role: 'employee',
    total_leaves: 2,
    password: 'password123',
  });

  // Request 5 days (2026-12-14 to 2026-12-18, Monday to Friday = 5 working days)
  await assert.rejects(
    dataService.applyLeave(lowBalanceEmp, {
      leave_type_name: 'Casual',
      start_date: '2026-12-14',
      end_date: '2026-12-18',
      reason: 'Leave request exceeding remaining balance',
    }),
    /Insufficient leave balance/
  );
});
