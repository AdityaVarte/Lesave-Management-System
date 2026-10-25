const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Employee = require('../models/Employee');
const LeaveType = require('../models/LeaveType');
const LeaveRequest = require('../models/LeaveRequest');
const intentHandlers = require('../services/intentHandlers');
const { getUserList } = require('../services/intentEngine');

let mongod;
let adminUser;
let rohanEmp;
let priyaEmp;
let casualType;
let sickType;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  casualType = await LeaveType.create({ type_name: 'Casual', max_days_per_request: 10, color: '#E4B84D' });
  sickType = await LeaveType.create({ type_name: 'Sick', max_days_per_request: 15, color: '#E07070' });

  adminUser = await Employee.create({
    name: 'Admin User',
    email: 'admin@company.com',
    department: 'HR',
    role: 'admin',
    total_leaves: 20,
    password: 'password123',
  });

  rohanEmp = await Employee.create({
    name: 'Rohan Sharma',
    email: 'rohan@company.com',
    department: 'Engineering',
    role: 'employee',
    total_leaves: 20,
    password: 'password123',
  });

  priyaEmp = await Employee.create({
    name: 'Priya Mehta',
    email: 'priya@company.com',
    department: 'Design',
    role: 'employee',
    total_leaves: 20,
    password: 'password123',
  });

  // Seed 1 Approved and 1 Pending leave for Rohan
  await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: casualType._id, type_name: casualType.type_name, color: casualType.color },
    start_date: new Date('2026-11-02T00:00:00.000+05:30'),
    end_date: new Date('2026-11-04T23:59:59.999+05:30'),
    reason: 'Family trip to home city for Diwali',
    status: 'Approved',
  });

  await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: sickType._id, type_name: sickType.type_name, color: sickType.color },
    start_date: new Date('2026-11-16T00:00:00.000+05:30'),
    end_date: new Date('2026-11-17T23:59:59.999+05:30'),
    reason: 'Medical recovery following flu',
    status: 'Pending',
  });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

test('intentHandlers - handleBalance formats confirmed remaining and available balance', async () => {
  const reply = await intentHandlers.handleBalance(rohanEmp);
  assert.ok(reply.includes('Confirmed Remaining:** 17 days'));
  assert.ok(reply.includes('Available Balance:** 15 days'));
});

test('intentHandlers - handleMyLeaves returns leaves and populates list context', async () => {
  const reply = await intentHandlers.handleMyLeaves(rohanEmp);
  assert.ok(reply.includes('Casual'));
  assert.ok(reply.includes('Sick'));

  // Verify list context stored for rohan
  const list = getUserList(rohanEmp._id);
  assert.ok(Array.isArray(list));
  assert.strictEqual(list.length, 2);
});

test('intentHandlers - handleLeaveStatus returns status of latest request', async () => {
  const reply = await intentHandlers.handleLeaveStatus(rohanEmp);
  assert.ok(reply.includes('Pending'));
  assert.ok(reply.includes('Sick'));
  assert.ok(reply.includes('Medical recovery'));
});

test('intentHandlers - handleLeaveTypes returns policy and limits', async () => {
  const reply = await intentHandlers.handleLeaveTypes(rohanEmp);
  assert.ok(reply.includes('Casual Leave'));
  assert.ok(reply.includes('Sick Leave'));
  assert.ok(reply.includes('10 working days'));
});

test('intentHandlers - admin endpoints politely refuse non-admin via dataService errors', async () => {
  const pendingReply = await intentHandlers.handlePendingList(rohanEmp);
  assert.ok(pendingReply.includes('Only administrators'));

  const deptReply = await intentHandlers.handleDepartmentSummary(rohanEmp);
  assert.ok(deptReply.includes('Only administrators'));

  const trendReply = await intentHandlers.handleMonthlyTrend(rohanEmp);
  assert.ok(trendReply.includes('Only administrators'));

  const whoReply = await intentHandlers.handleWhoIsOnLeave(rohanEmp);
  assert.ok(whoReply.includes('Only administrators'));

  const empReply = await intentHandlers.handleEmployeeLeaves(rohanEmp, { employee: { email: 'priya@company.com' } });
  assert.ok(empReply.includes('Employees can only view their own leave requests'));
});

test('intentHandlers - admin endpoints succeed when called by admin', async () => {
  const pendingReply = await intentHandlers.handlePendingList(adminUser);
  assert.ok(pendingReply.includes('Rohan Sharma'));
  assert.ok(pendingReply.includes('1.'));

  const deptReply = await intentHandlers.handleDepartmentSummary(adminUser);
  assert.ok(deptReply.includes('Engineering'));

  const trendReply = await intentHandlers.handleMonthlyTrend(adminUser);
  assert.ok(trendReply.includes('Company Monthly Leave Trends'));

  const whoReply = await intentHandlers.handleWhoIsOnLeave(adminUser, {
    dates: { from: '2026-11-03', to: '2026-11-03' },
  });
  assert.ok(whoReply.includes('Rohan Sharma'));

  const empReply = await intentHandlers.handleEmployeeLeaves(adminUser, {
    employee: { email: 'rohan@company.com' },
  });
  assert.ok(empReply.includes('Rohan Sharma'));
});

test('intentHandlers - formatLeavesList displays overflow notice when rows exceed 10', () => {
  const fakeRows = Array.from({ length: 12 }, (_, i) => ({
    _id: `id${i}`,
    leave_type: { type_name: 'Casual' },
    start_date: new Date('2026-11-01'),
    end_date: new Date('2026-11-02'),
    working_days: 2,
    status: 'Approved',
  }));

  const text = intentHandlers.formatLeavesList(fakeRows, 12, 'Test Leaves');
  assert.ok(text.includes('10.'));
  assert.ok(!text.includes('11.'));
  assert.ok(text.includes('2 more. Ask for a PDF to get all.'));
});
