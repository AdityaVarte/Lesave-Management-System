const test = require('node:test');
const assert = require('node:assert');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Employee = require('../models/Employee');
const LeaveType = require('../models/LeaveType');
const LeaveRequest = require('../models/LeaveRequest');
const dataService = require('../services/dataService');
const {
  PermissionDeniedError,
  ValidationError,
  NotFoundError,
} = dataService;

let mongod;
let adminUser;
let rohanEmp;
let priyaEmp;
let casualType;
let sickType;
let paidType;
let rohanPendingLeave;
let priyaPendingLeave;

test.before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Seed Leave Types
  casualType = await LeaveType.create({ type_name: 'Casual', max_days_per_request: 10, color: '#E4B84D' });
  sickType = await LeaveType.create({ type_name: 'Sick', max_days_per_request: 15, color: '#E07070' });
  paidType = await LeaveType.create({ type_name: 'Paid', max_days_per_request: 20, color: '#70C090' });

  // Seed Employees
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

  // Seed Leaves for Rohan: 1 Approved (3 days), 1 Pending (2 days)
  await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: casualType._id, type_name: casualType.type_name, color: casualType.color },
    start_date: new Date('2026-11-02T00:00:00.000+05:30'),
    end_date: new Date('2026-11-04T23:59:59.999+05:30'),
    reason: 'Family function and travel back home',
    status: 'Approved',
  });

  rohanPendingLeave = await LeaveRequest.create({
    employee_ref: rohanEmp._id,
    employee_snapshot: { name: rohanEmp.name, email: rohanEmp.email, department: rohanEmp.department },
    leave_type: { type_id: sickType._id, type_name: sickType.type_name, color: sickType.color },
    start_date: new Date('2026-11-16T00:00:00.000+05:30'),
    end_date: new Date('2026-11-17T23:59:59.999+05:30'),
    reason: 'Medical checkup and diagnostic tests',
    status: 'Pending',
  });

  // Seed Leaves for Priya: 1 Approved (2 days), 1 Pending (1 day)
  await LeaveRequest.create({
    employee_ref: priyaEmp._id,
    employee_snapshot: { name: priyaEmp.name, email: priyaEmp.email, department: priyaEmp.department },
    leave_type: { type_id: casualType._id, type_name: casualType.type_name, color: casualType.color },
    start_date: new Date('2026-11-09T00:00:00.000+05:30'),
    end_date: new Date('2026-11-10T23:59:59.999+05:30'),
    reason: 'Personal work and home maintenance',
    status: 'Approved',
  });

  priyaPendingLeave = await LeaveRequest.create({
    employee_ref: priyaEmp._id,
    employee_snapshot: { name: priyaEmp.name, email: priyaEmp.email, department: priyaEmp.department },
    leave_type: { type_id: paidType._id, type_name: paidType.type_name, color: paidType.color },
    start_date: new Date('2026-11-23T00:00:00.000+05:30'),
    end_date: new Date('2026-11-23T23:59:59.999+05:30'),
    reason: 'Taking a rest day after design sprint',
    status: 'Pending',
  });
});

test.after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ─── 1. Balance Role Scoping ──────────────────────────────────────────────────
test('getBalance - employee gets own balance with Confirmed Remaining and Available Balance', async () => {
  const result = await dataService.getBalance(rohanEmp);
  assert.strictEqual(result.total, 20);
  assert.strictEqual(result.approvedDays, 3);
  assert.strictEqual(result.pendingDays, 2);
  assert.strictEqual(result.confirmedRemaining, 17); // 20 - 3
  assert.strictEqual(result.availableBalance, 15);   // 20 - 3 - 2
});

test('getBalance - employee cannot access another employee balance', async () => {
  await assert.rejects(
    async () => {
      await dataService.getBalance(rohanEmp, priyaEmp._id);
    },
    (err) => {
      assert.ok(err instanceof PermissionDeniedError);
      assert.match(err.message, /Employees can only view their own leave balance/);
      return true;
    }
  );
});

test('getBalance - admin can view any employee balance', async () => {
  const result = await dataService.getBalance(adminUser, priyaEmp._id);
  assert.strictEqual(result.employee.email, 'priya@company.com');
  assert.strictEqual(result.total, 20);
  assert.strictEqual(result.approvedDays, 2);
  assert.strictEqual(result.pendingDays, 1);
  assert.strictEqual(result.confirmedRemaining, 18);
  assert.strictEqual(result.availableBalance, 17);
});

// ─── 2. searchLeaves Role Scoping ─────────────────────────────────────────────
test('searchLeaves - employee is strictly forced to own leaves and ignores foreign filters', async () => {
  // Rohan attempts to search Priya's email and department
  const result = await dataService.searchLeaves(rohanEmp, {
    employee_email: 'priya@company.com',
    department: 'Design',
  });

  // Must only return Rohan's leaves
  assert.strictEqual(result.rows.length, 2);
  for (const row of result.rows) {
    assert.strictEqual(row.employee_ref.toString(), rohanEmp._id.toString());
    assert.strictEqual(row.employee_snapshot.email, 'rohan@company.com');
  }
});

test('searchLeaves - admin can filter by employee email and department', async () => {
  const priyaResult = await dataService.searchLeaves(adminUser, {
    employee_email: 'priya@company.com',
  });
  assert.strictEqual(priyaResult.rows.length, 2);
  assert.strictEqual(priyaResult.rows[0].employee_snapshot.email, 'priya@company.com');

  const engResult = await dataService.searchLeaves(adminUser, {
    department: 'Engineering',
  });
  assert.strictEqual(engResult.rows.length, 2);
  assert.strictEqual(engResult.rows[0].employee_snapshot.department, 'Engineering');
});

test('searchLeaves - never returns password or secret fields', async () => {
  const result = await dataService.searchLeaves(adminUser, {});
  for (const row of result.rows) {
    assert.strictEqual(row.password, undefined);
    assert.strictEqual(row.employee_snapshot.password, undefined);
  }
});

// ─── 3. Admin-Only Operations ─────────────────────────────────────────────────
test('admin operations - non-admin is rejected on all admin read endpoints', async () => {
  await assert.rejects(
    async () => await dataService.getPendingLeaves(rohanEmp),
    PermissionDeniedError
  );
  await assert.rejects(
    async () => await dataService.getDepartmentSummary(rohanEmp),
    PermissionDeniedError
  );
  await assert.rejects(
    async () => await dataService.getMonthlyTrend(rohanEmp),
    PermissionDeniedError
  );
  await assert.rejects(
    async () => await dataService.getWhoIsOnLeave(rohanEmp),
    PermissionDeniedError
  );
  await assert.rejects(
    async () => await dataService.lookupEmployee(rohanEmp, 'priya@company.com'),
    PermissionDeniedError
  );
});

test('admin operations - admin succeeds on all admin read endpoints', async () => {
  const pending = await dataService.getPendingLeaves(adminUser);
  assert.strictEqual(pending.rows.length, 2); // 1 from Rohan, 1 from Priya

  const summary = await dataService.getDepartmentSummary(adminUser);
  assert.ok(Array.isArray(summary));
  assert.ok(summary.length >= 2);

  const trend = await dataService.getMonthlyTrend(adminUser, 2026);
  assert.strictEqual(trend.length, 12);

  const whoIsOnLeave = await dataService.getWhoIsOnLeave(adminUser, {
    from: '2026-11-03',
    to: '2026-11-03',
  });
  assert.strictEqual(whoIsOnLeave.rows.length, 1);
  assert.strictEqual(whoIsOnLeave.rows[0].employee_snapshot.name, 'Rohan Sharma');

  const emp = await dataService.lookupEmployee(adminUser, 'priya@company.com');
  assert.strictEqual(emp.name, 'Priya Mehta');
  assert.strictEqual(emp.password, undefined); // password never returned
});

// ─── 4. Mutations Role Scoping & Rules ─────────────────────────────────────────
test('applyLeave - employee cannot apply on behalf of someone else', async () => {
  // Rohan attempts to apply passing Priya's ID
  const created = await dataService.applyLeave(rohanEmp, {
    leave_type_name: 'Casual',
    start_date: '2026-12-01',
    end_date: '2026-12-02',
    reason: 'Personal errands and family trip',
    employee_id: priyaEmp._id, // Attempt to spoof
  });

  // Forced to Rohan's id
  assert.strictEqual(created.employee_ref.toString(), rohanEmp._id.toString());
  assert.strictEqual(created.employee_snapshot.email, 'rohan@company.com');
});

test('applyLeave - enforces max_days_per_request per leave type', async () => {
  // Casual max is 10 days; requesting 12 working days must fail
  await assert.rejects(
    async () => {
      await dataService.applyLeave(rohanEmp, {
        leave_type_name: 'Casual',
        start_date: '2026-12-01',
        end_date: '2026-12-16', // 12 working days
        reason: 'Long casual leave taking two full weeks',
      });
    },
    (err) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /cannot exceed 10 working days/);
      return true;
    }
  );
});

test('applyLeave - blocks overlapping requests', async () => {
  // Rohan already has approved leave 2026-11-02 to 2026-11-04
  await assert.rejects(
    async () => {
      await dataService.applyLeave(rohanEmp, {
        leave_type_name: 'Casual',
        start_date: '2026-11-03',
        end_date: '2026-11-05',
        reason: 'Overlapping request attempt on same dates',
      });
    },
    (err) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.message, /overlap/i);
      return true;
    }
  );
});

test('approveLeave and rejectLeave - non-admin rejected, admin succeeds', async () => {
  // Non-admin cannot approve
  await assert.rejects(
    async () => await dataService.approveLeave(rohanEmp, priyaPendingLeave._id),
    PermissionDeniedError
  );

  // Admin approves
  const approved = await dataService.approveLeave(adminUser, priyaPendingLeave._id);
  assert.strictEqual(approved.status, 'Approved');

  // Trying to approve an already approved leave fails
  await assert.rejects(
    async () => await dataService.approveLeave(adminUser, priyaPendingLeave._id),
    ValidationError
  );

  // Non-admin cannot reject
  await assert.rejects(
    async () => await dataService.rejectLeave(rohanEmp, rohanPendingLeave._id, 'Denied'),
    PermissionDeniedError
  );
});

test('cancelLeave - employee cannot cancel another employee leave', async () => {
  // Rohan tries to cancel Priya's leave
  await assert.rejects(
    async () => await dataService.cancelLeave(rohanEmp, priyaPendingLeave._id),
    PermissionDeniedError
  );
});

test('cancelLeave - employee can cancel own pending leave', async () => {
  // Rohan cancels his own pending leave
  const res = await dataService.cancelLeave(rohanEmp, rohanPendingLeave._id);
  assert.strictEqual(res.message, 'Leave cancelled successfully');

  // Verify it is deleted
  const check = await LeaveRequest.findById(rohanPendingLeave._id);
  assert.strictEqual(check, null);
});
