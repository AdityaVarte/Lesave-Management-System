const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const LeaveType = require('../models/LeaveType');
const { calcWorkingDays } = require('../utils/workingDays');
const {
  getCalcuttaTodayString,
  getCalcuttaDayBounds,
  getCalcuttaMonthBounds,
  formatDisplayDate,
} = require('../utils/dateUtils');

// Custom error classes for fine-grained error handling
class PermissionDeniedError extends Error {
  constructor(message = 'Access denied') {
    super(message);
    this.name = 'PermissionDeniedError';
    this.status = 403;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

/**
 * Escape string for safe use in RegExp.
 */
const escapeRegex = (string) => {
  return typeof string === 'string' ? string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
};

/**
 * Standard fields to project for LeaveRequest reads.
 * Guarantees no sensitive data is selected.
 */
const LEAVE_PROJECTION = [
  '_id',
  'employee_ref',
  'employee_snapshot',
  'leave_type',
  'start_date',
  'end_date',
  'working_days',
  'is_half_day',
  'reason',
  'status',
  'rejection_reason',
  'applied_on',
].join(' ');

/**
 * Allowed departments defined by Employee schema enum.
 */
const ALLOWED_DEPARTMENTS = ['Engineering', 'Design', 'Finance', 'HR', 'Marketing', 'Operations'];

/**
 * Get leave balance for an employee.
 * Role Scoped: Employees can ONLY view their own balance. Admin can view anyone's balance.
 * Returns both Confirmed Remaining (total - Approved) and Available Balance (total - Approved - Pending).
 */
const getBalance = async (user, targetEmployeeId = null) => {
  if (!user || !user._id) {
    throw new PermissionDeniedError('Authentication required');
  }

  const userIdStr = String(user._id);
  const targetIdStr = targetEmployeeId ? String(targetEmployeeId) : userIdStr;

  // Role scoping enforcement
  if (user.role !== 'admin' && targetIdStr !== userIdStr) {
    throw new PermissionDeniedError('Access denied: Employees can only view their own leave balance');
  }

  const employee = await Employee.findById(targetIdStr)
    .select('_id name email department role total_leaves')
    .lean();

  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  // Aggregate used days by status
  const balanceResult = await LeaveRequest.aggregate([
    { $match: { employee_ref: new mongoose.Types.ObjectId(targetIdStr) } },
    { $group: { _id: '$status', days: { $sum: '$working_days' } } },
  ]);

  const stats = { Approved: 0, Pending: 0, Rejected: 0 };
  for (const item of balanceResult) {
    if (stats[item._id] !== undefined) {
      stats[item._id] = item.days;
    }
  }

  const total = employee.total_leaves || 20;
  const approvedDays = stats.Approved;
  const pendingDays = stats.Pending;
  const rejectedDays = stats.Rejected;

  // Confirmed Remaining: total allocated minus officially Approved leaves
  const confirmedRemaining = Math.max(0, total - approvedDays);
  // Available Balance: total allocated minus both Approved and Pending requests
  const availableBalance = Math.max(0, total - approvedDays - pendingDays);

  return {
    employee: {
      id: employee._id.toString(),
      name: employee.name,
      email: employee.email,
      department: employee.department,
      role: employee.role,
    },
    total,
    approvedDays,
    pendingDays,
    rejectedDays,
    confirmedRemaining,
    availableBalance,
  };
};

/**
 * Search leaves with strict role-scoping and whitelisted filters.
 * Cap at max 200 rows, deterministic sort.
 * If user is not admin, forces employee_ref = user._id and ignores other employee/department filters.
 */
const searchLeaves = async (user, filters = {}) => {
  if (!user || !user._id) {
    throw new PermissionDeniedError('Authentication required');
  }

  const query = {};
  const isAdmin = user.role === 'admin';

  // 1. Role scoping: Non-admins strictly locked to own records
  if (!isAdmin) {
    query.employee_ref = new mongoose.Types.ObjectId(String(user._id));
  } else {
    // Admin filtering
    if (filters.employee_id) {
      if (mongoose.Types.ObjectId.isValid(filters.employee_id)) {
        query.employee_ref = new mongoose.Types.ObjectId(String(filters.employee_id));
      }
    } else if (filters.employee_email) {
      const email = String(filters.employee_email).trim().toLowerCase();
      const targetEmp = await Employee.findOne({ email }).select('_id').lean();
      if (!targetEmp) {
        return { rows: [], total: 0, truncated: false };
      }
      query.employee_ref = targetEmp._id;
    }

    if (filters.department) {
      const deptNormalized = String(filters.department).trim();
      const matchedDept = ALLOWED_DEPARTMENTS.find(
        (d) => d.toLowerCase() === deptNormalized.toLowerCase()
      );
      if (matchedDept) {
        query['employee_snapshot.department'] = matchedDept;
      }
    }
  }

  // 2. Status filter
  if (filters.status) {
    const rawStatus = String(filters.status).trim().toLowerCase();
    const validStatus = ['pending', 'approved', 'rejected'].find((s) => s === rawStatus);
    if (validStatus) {
      query.status = validStatus.charAt(0).toUpperCase() + validStatus.slice(1);
    }
  }

  // 3. Leave type filter
  if (filters.leave_type) {
    const rawType = String(filters.leave_type).trim().toLowerCase();
    const validTypes = ['casual', 'sick', 'paid'];
    const matchedType = validTypes.find((t) => t === rawType);
    if (matchedType) {
      query['leave_type.type_name'] = matchedType.charAt(0).toUpperCase() + matchedType.slice(1);
    }
  }

  // 4. Date filtering (comparing in UTC with Asia/Calcutta bounds)
  if (filters.month) {
    const [y, m] = String(filters.month).split('-');
    if (y && m) {
      const bounds = getCalcuttaMonthBounds(Number(y), Number(m));
      query.start_date = { $lte: bounds.end };
      query.end_date = { $gte: bounds.start };
    }
  } else {
    if (filters.from && filters.to) {
      const fromBounds = getCalcuttaDayBounds(filters.from);
      const toBounds = getCalcuttaDayBounds(filters.to);
      query.start_date = { $lte: toBounds.end };
      query.end_date = { $gte: fromBounds.start };
    } else if (filters.from) {
      const fromBounds = getCalcuttaDayBounds(filters.from);
      query.end_date = { $gte: fromBounds.start };
    } else if (filters.to) {
      const toBounds = getCalcuttaDayBounds(filters.to);
      query.start_date = { $lte: toBounds.end };
    }
  }

  // 5. Pagination & limits: maximum capped at 200
  const limit = Math.max(1, Math.min(Number(filters.limit) || 50, 200));
  const page = Math.max(1, Number(filters.page) || 1);
  const skip = (page - 1) * limit;

  const total = await LeaveRequest.countDocuments(query);
  const rows = await LeaveRequest.find(query)
    .select(LEAVE_PROJECTION)
    .sort({ applied_on: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    rows,
    total,
    truncated: total > rows.length,
  };
};

/**
 * Get the current user's leaves.
 * Always forces employee_ref = user._id.
 */
const getMyLeaves = async (user, options = {}) => {
  return await searchLeaves(user, { ...options, employee_id: undefined, employee_email: undefined });
};

/**
 * Retrieve the status of the user's latest leave request.
 * Always forces employee_ref = user._id.
 */
const getLastLeaveStatus = async (user) => {
  if (!user || !user._id) {
    throw new PermissionDeniedError('Authentication required');
  }

  const latest = await LeaveRequest.findOne({
    employee_ref: new mongoose.Types.ObjectId(String(user._id)),
  })
    .select(LEAVE_PROJECTION)
    .sort({ applied_on: -1, _id: -1 })
    .lean();

  return latest;
};

/**
 * Get all available leave types with quota rules.
 */
const getLeaveTypes = async () => {
  return await LeaveType.find()
    .select('type_name max_days_per_request color')
    .sort({ type_name: 1 })
    .lean();
};

/**
 * Get pending leave requests.
 * Admin only.
 */
const getPendingLeaves = async (user, filters = {}) => {
  if (!user || user.role !== 'admin') {
    throw new PermissionDeniedError('Access denied: Admin permission required to view all pending requests');
  }

  const query = { status: 'Pending' };
  if (filters.department) {
    const matchedDept = ALLOWED_DEPARTMENTS.find(
      (d) => d.toLowerCase() === String(filters.department).trim().toLowerCase()
    );
    if (matchedDept) {
      query['employee_snapshot.department'] = matchedDept;
    }
  }

  const limit = Math.max(1, Math.min(Number(filters.limit) || 50, 200));
  const total = await LeaveRequest.countDocuments(query);
  const rows = await LeaveRequest.find(query)
    .select(LEAVE_PROJECTION)
    .sort({ applied_on: -1, _id: -1 })
    .limit(limit)
    .lean();

  return {
    rows,
    total,
    truncated: total > rows.length,
  };
};

/**
 * Get aggregated leave statistics per department.
 * Admin only. Supports optional from, to, and status filters.
 */
const getDepartmentSummary = async (user, options = {}) => {
  if (!user || user.role !== 'admin') {
    throw new PermissionDeniedError('Access denied: Admin permission required to view department summary');
  }

  const opts = typeof options === 'object' && options !== null ? options : {};
  const rawStatus = opts.status || 'Approved';
  const from = opts.from;
  const to = opts.to;

  const match = {};
  if (rawStatus && rawStatus.toLowerCase() !== 'all') {
    const validStatus = ['pending', 'approved', 'rejected'].find((s) => s === rawStatus.toLowerCase());
    match.status = validStatus ? (validStatus.charAt(0).toUpperCase() + validStatus.slice(1)) : rawStatus;
  }

  if (from && to) {
    const fromBounds = getCalcuttaDayBounds(from);
    const toBounds = getCalcuttaDayBounds(to);
    match.start_date = { $lte: toBounds.end };
    match.end_date = { $gte: fromBounds.start };
  } else if (from) {
    const fromBounds = getCalcuttaDayBounds(from);
    match.end_date = { $gte: fromBounds.start };
  } else if (to) {
    const toBounds = getCalcuttaDayBounds(to);
    match.start_date = { $lte: toBounds.end };
  }

  const data = await LeaveRequest.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$employee_snapshot.department',
        totalDays: { $sum: '$working_days' },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalDays: -1 } },
  ]);

  return data.map((d) => ({
    department: d._id || 'Unknown',
    totalDays: d.totalDays,
    count: d.count,
  }));
};

/**
 * Get monthly trend of leaves with optional year, from, to, and status filters.
 * Admin only.
 */
const getMonthlyTrend = async (user, options = null) => {
  if (!user || user.role !== 'admin') {
    throw new PermissionDeniedError('Access denied: Admin permission required to view monthly trends');
  }

  let targetYear = null;
  let from = null;
  let to = null;
  let rawStatus = 'Approved';

  if (typeof options === 'number' || typeof options === 'string') {
    targetYear = Number(options);
  } else if (typeof options === 'object' && options !== null) {
    if (options.year) targetYear = Number(options.year);
    if (options.from) from = options.from;
    if (options.to) to = options.to;
    if (options.status) rawStatus = options.status;
  }

  if (!targetYear) {
    if (from) {
      targetYear = Number(String(from).split('-')[0]);
    } else {
      targetYear = Number(getCalcuttaTodayString().split('-')[0]);
    }
  }

  const match = {};
  if (rawStatus && rawStatus.toLowerCase() !== 'all') {
    const validStatus = ['pending', 'approved', 'rejected'].find((s) => s === rawStatus.toLowerCase());
    match.status = validStatus ? (validStatus.charAt(0).toUpperCase() + validStatus.slice(1)) : rawStatus;
  }

  if (from || to) {
    if (from && to) {
      const fb = getCalcuttaDayBounds(from);
      const tb = getCalcuttaDayBounds(to);
      match.start_date = { $lte: tb.end };
      match.end_date = { $gte: fb.start };
    } else if (from) {
      const fb = getCalcuttaDayBounds(from);
      match.end_date = { $gte: fb.start };
    } else if (to) {
      const tb = getCalcuttaDayBounds(to);
      match.start_date = { $lte: tb.end };
    }
  } else {
    const startOfYear = new Date(`${targetYear}-01-01T00:00:00.000+05:30`);
    const endOfYear = new Date(`${targetYear}-12-31T23:59:59.999+05:30`);
    match.start_date = { $gte: startOfYear, $lte: endOfYear };
  }

  const data = await LeaveRequest.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $month: '$start_date' },
        totalDays: { $sum: '$working_days' },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthMap = {};
  for (const item of data) {
    monthMap[item._id] = item;
  }

  return monthNames.map((name, idx) => {
    const monthNum = idx + 1;
    const found = monthMap[monthNum];
    return {
      month: name,
      monthNumber: monthNum,
      year: targetYear,
      totalDays: found ? found.totalDays : 0,
      count: found ? found.count : 0,
    };
  });
};

/**
 * Check who is on leave during a given date window.
 * Admin only. Overlaps with [from, to].
 */
const getWhoIsOnLeave = async (user, { from = null, to = null, limit = 50 } = {}) => {
  if (!user || user.role !== 'admin') {
    throw new PermissionDeniedError('Access denied: Admin permission required to see who is on leave');
  }

  const todayStr = getCalcuttaTodayString();
  const fromBounds = from ? getCalcuttaDayBounds(from) : getCalcuttaDayBounds(todayStr);
  const toBounds = to ? getCalcuttaDayBounds(to) : fromBounds;

  const query = {
    status: 'Approved',
    start_date: { $lte: toBounds.end },
    end_date: { $gte: fromBounds.start },
  };

  const maxLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const total = await LeaveRequest.countDocuments(query);
  const rows = await LeaveRequest.find(query)
    .select(LEAVE_PROJECTION)
    .sort({ start_date: 1, 'employee_snapshot.name': 1 })
    .limit(maxLimit)
    .lean();

  return {
    rows,
    total,
    truncated: total > rows.length,
    window: {
      from: fromBounds.dateString,
      to: toBounds.dateString,
    },
  };
};

/**
 * Look up employee by email or name.
 * Admin only. Never returns passwords.
 */
const lookupEmployee = async (user, identifier) => {
  if (!user || user.role !== 'admin') {
    throw new PermissionDeniedError('Access denied: Admin permission required to lookup employees');
  }

  if (!identifier || typeof identifier !== 'string') {
    return null;
  }

  const clean = identifier.trim();
  if (clean.includes('@')) {
    return await Employee.findOne({ email: clean.toLowerCase() })
      .select('_id name email department role total_leaves')
      .lean();
  }

  // Name search using escaped regex
  return await Employee.findOne({ name: new RegExp(`^${escapeRegex(clean)}$`, 'i') })
    .select('_id name email department role total_leaves')
    .lean();
};

/**
 * Retrieve single leave by ID.
 * Role Scoped: Employees can ONLY view their own leave requests.
 */
const getLeaveById = async (user, leaveId) => {
  if (!user || !user._id) {
    throw new PermissionDeniedError('Authentication required');
  }

  if (!mongoose.Types.ObjectId.isValid(leaveId)) {
    throw new ValidationError('Invalid leave ID format');
  }

  const leave = await LeaveRequest.findById(leaveId).select(LEAVE_PROJECTION).lean();
  if (!leave) {
    throw new NotFoundError('Leave request not found');
  }

  if (user.role !== 'admin' && leave.employee_ref.toString() !== user._id.toString()) {
    throw new PermissionDeniedError('Access denied: You can only view your own leave requests');
  }

  return leave;
};

/**
 * Validate leave application parameters without creating document.
 * Used during slot filling and pre-confirmation validation.
 */
const validateLeaveApplication = async (
  user,
  {
    leave_type_name,
    start_date,
    end_date,
    is_half_day = false,
    reason,
    employee_id = null,
  }
) => {
  if (!user || !user._id) {
    throw new PermissionDeniedError('Authentication required');
  }

  const targetEmployeeId =
    user.role === 'admin' && employee_id ? String(employee_id) : String(user._id);

  const employee = await Employee.findById(targetEmployeeId);
  if (!employee) {
    throw new NotFoundError('Employee not found');
  }

  if (!leave_type_name) {
    throw new ValidationError('Leave type is required');
  }

  const cleanTypeName = String(leave_type_name).trim();
  const leaveType = await LeaveType.findOne({
    type_name: new RegExp(`^${escapeRegex(cleanTypeName)}$`, 'i'),
  });
  if (!leaveType) {
    throw new NotFoundError(`Leave type "${cleanTypeName}" not found`);
  }

  const todayBounds = getCalcuttaDayBounds();
  const startDayBounds = getCalcuttaDayBounds(start_date);
  const endDayBounds = getCalcuttaDayBounds(end_date || start_date);

  // CHECK 1: Past date check
  if (startDayBounds.start < todayBounds.start) {
    throw new ValidationError('Start date cannot be in the past');
  }

  // CHECK 2: End date before start date
  if (endDayBounds.start < startDayBounds.start) {
    throw new ValidationError('End date must be on or after start date');
  }

  // CHECK 3: Working days calculation
  const calculatedDays = calcWorkingDays(startDayBounds.start, endDayBounds.start, is_half_day);
  if (calculatedDays <= 0) {
    throw new ValidationError('The selected date range contains 0 working days (e.g. weekend only)');
  }

  // CHECK 4: Enforce max_days_per_request from LeaveType
  if (leaveType.max_days_per_request && calculatedDays > leaveType.max_days_per_request) {
    throw new ValidationError(
      `Single request for ${leaveType.type_name} leave cannot exceed ${leaveType.max_days_per_request} working days (requested: ${calculatedDays} days)`
    );
  }

  // CHECK 5: Overlap detection
  const overlap = await LeaveRequest.findOne({
    employee_ref: targetEmployeeId,
    status: { $ne: 'Rejected' },
    start_date: { $lte: endDayBounds.end },
    end_date: { $gte: startDayBounds.start },
  }).lean();

  if (overlap) {
    throw new ValidationError(
      `Leave dates overlap with an existing ${overlap.status} request (${overlap.leave_type.type_name} from ${formatDisplayDate(overlap.start_date)} to ${formatDisplayDate(overlap.end_date)})`
    );
  }

  // CHECK 6: Available balance check
  const balanceAgg = await LeaveRequest.aggregate([
    {
      $match: {
        employee_ref: new mongoose.Types.ObjectId(targetEmployeeId),
        status: { $in: ['Approved', 'Pending'] },
      },
    },
    { $group: { _id: null, used: { $sum: '$working_days' } } },
  ]);

  const used = balanceAgg[0]?.used || 0;
  const availableRemaining = Math.max(0, employee.total_leaves - used);
  if (calculatedDays > availableRemaining) {
    throw new ValidationError(
      `Insufficient leave balance: ${availableRemaining} days available, ${calculatedDays} days requested`
    );
  }

  // CHECK 7: Reason validation
  if (reason !== undefined) {
    if (!reason || reason.trim().length < 10) {
      throw new ValidationError('Reason must be at least 10 characters');
    }
  }

  return {
    valid: true,
    employee,
    leaveType,
    calculatedDays,
    startDayBounds,
    endDayBounds,
    availableRemaining,
  };
};

/**
 * Apply for leave with full validation:
 * - Checks past date relative to Asia/Calcutta today
 * - Checks end_date >= start_date
 * - Working days > 0
 * - Enforces max_days_per_request from LeaveType
 * - Checks date overlap with existing non-rejected requests
 * - Checks sufficient balance (total - approved - pending)
 * - Checks reason length >= 10 characters
 */
const applyLeave = async (
  user,
  {
    leave_type_name,
    start_date,
    end_date,
    is_half_day = false,
    reason,
    employee_id = null,
  }
) => {
  const validated = await validateLeaveApplication(user, {
    leave_type_name,
    start_date,
    end_date,
    is_half_day,
    reason,
    employee_id,
  });

  const targetEmployeeId =
    user.role === 'admin' && employee_id ? String(employee_id) : String(user._id);

  // Create request (pre-save hook also verifies working_days)
  const leaveRequest = new LeaveRequest({
    employee_ref: targetEmployeeId,
    employee_snapshot: {
      name: validated.employee.name,
      email: validated.employee.email,
      department: validated.employee.department,
    },
    leave_type: {
      type_id: validated.leaveType._id,
      type_name: validated.leaveType.type_name,
      color: validated.leaveType.color,
    },
    start_date: validated.startDayBounds.start,
    end_date: validated.endDayBounds.end,
    is_half_day: Boolean(is_half_day),
    reason: reason.trim(),
    status: 'Pending',
    applied_on: new Date(),
  });

  await leaveRequest.save();
  return leaveRequest.toObject();
};

/**
 * Check balance impact if an admin approves a leave request.
 * Returns warning details if balance goes below zero.
 */
const checkApproveBalanceImpact = async (leaveId) => {
  if (!mongoose.Types.ObjectId.isValid(leaveId)) return null;
  const leave = await LeaveRequest.findById(leaveId).lean();
  if (!leave) return null;

  const employee = await Employee.findById(leave.employee_ref).lean();
  if (!employee) return null;

  const balanceAgg = await LeaveRequest.aggregate([
    {
      $match: {
        employee_ref: leave.employee_ref,
        status: 'Approved',
        _id: { $ne: leave._id },
      },
    },
    { $group: { _id: null, used: { $sum: '$working_days' } } },
  ]);

  const used = balanceAgg[0]?.used || 0;
  const newBalance = employee.total_leaves - used - leave.working_days;

  return {
    employeeName: employee.name,
    department: employee.department,
    workingDays: leave.working_days,
    currentBalance: employee.total_leaves - used,
    newBalance,
    isNegative: newBalance < 0,
  };
};

/**
 * Approve leave request.
 * Admin only. Uses atomic findOneAndUpdate with status: 'Pending'.
 */
const approveLeave = async (user, leaveId) => {
  if (!user || user.role !== 'admin') {
    throw new PermissionDeniedError('Access denied: Admin permission required to approve leaves');
  }

  if (!mongoose.Types.ObjectId.isValid(leaveId)) {
    throw new ValidationError('Invalid leave ID format');
  }

  // Atomic update: only update if status is still 'Pending'
  const updated = await LeaveRequest.findOneAndUpdate(
    { _id: leaveId, status: 'Pending' },
    { $set: { status: 'Approved' } },
    { new: true }
  ).lean();

  if (!updated) {
    const existing = await LeaveRequest.findById(leaveId).lean();
    if (!existing) {
      throw new NotFoundError('Leave request not found');
    }
    throw new ValidationError(
      `This leave request is no longer pending (current status: ${existing.status}).`
    );
  }

  return updated;
};

/**
 * Reject leave request.
 * Admin only. Uses atomic findOneAndUpdate with status: 'Pending'. Reason required.
 */
const rejectLeave = async (user, leaveId, rejectionReason) => {
  if (!user || user.role !== 'admin') {
    throw new PermissionDeniedError('Access denied: Admin permission required to reject leaves');
  }

  if (!mongoose.Types.ObjectId.isValid(leaveId)) {
    throw new ValidationError('Invalid leave ID format');
  }

  if (!rejectionReason || !rejectionReason.trim()) {
    throw new ValidationError('A rejection reason is required');
  }

  // Atomic update: only update if status is still 'Pending'
  const updated = await LeaveRequest.findOneAndUpdate(
    { _id: leaveId, status: 'Pending' },
    { $set: { status: 'Rejected', rejection_reason: rejectionReason.trim() } },
    { new: true }
  ).lean();

  if (!updated) {
    const existing = await LeaveRequest.findById(leaveId).lean();
    if (!existing) {
      throw new NotFoundError('Leave request not found');
    }
    throw new ValidationError(
      `This leave request is no longer pending (current status: ${existing.status}).`
    );
  }

  return updated;
};

/**
 * Cancel pending leave request.
 * Employee can only cancel their own pending leaves. Uses atomic findOneAndDelete.
 */
const cancelLeave = async (user, leaveId) => {
  if (!user || !user._id) {
    throw new PermissionDeniedError('Authentication required');
  }

  if (!mongoose.Types.ObjectId.isValid(leaveId)) {
    throw new ValidationError('Invalid leave ID format');
  }

  const existing = await LeaveRequest.findById(leaveId).lean();
  if (!existing) {
    throw new NotFoundError('Leave request not found');
  }

  if (existing.employee_ref.toString() !== user._id.toString()) {
    throw new PermissionDeniedError('Access denied: You can only cancel your own leaves');
  }

  // Atomic delete: only delete if status is still 'Pending' and owner matches
  const deleted = await LeaveRequest.findOneAndDelete({
    _id: leaveId,
    status: 'Pending',
    employee_ref: user._id,
  }).lean();

  if (!deleted) {
    throw new ValidationError(
      `This leave request is no longer pending (current status: ${existing.status}).`
    );
  }

  return {
    message: 'Leave cancelled successfully',
    leaveId: leaveId.toString(),
  };
};

module.exports = {
  // Error classes
  PermissionDeniedError,
  ValidationError,
  NotFoundError,

  // Queries
  getBalance,
  searchLeaves,
  getMyLeaves,
  getLastLeaveStatus,
  getLeaveTypes,
  getPendingLeaves,
  getDepartmentSummary,
  getMonthlyTrend,
  getWhoIsOnLeave,
  lookupEmployee,
  getLeaveById,

  // Mutations & Helpers
  validateLeaveApplication,
  checkApproveBalanceImpact,
  applyLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
};
