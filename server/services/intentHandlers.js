const dataService = require('./dataService');
const pdfService = require('./pdfService');
const { formatDisplayDate, formatISODate } = require('../utils/dateUtils');
const { storeUserList, getUserList, getUserListContext } = require('./intentEngine');
const { createPendingAction } = require('./pendingActions');
const { setSlotState, clearSlotState } = require('./slotFilling');

/**
 * Format a list of leave requests for display.
 * Max 10 rows shown with overflow message.
 */
const formatLeavesList = (rows, total, prefix = 'Leave Requests') => {
  if (!rows || rows.length === 0) {
    return 'No leave requests found matching your query.';
  }

  const lines = [`**${prefix}** (${total} total):`];
  const maxShown = Math.min(rows.length, 10);

  for (let i = 0; i < maxShown; i++) {
    const row = rows[i];
    const nameStr = row.employee_snapshot?.name ? `${row.employee_snapshot.name} - ` : '';
    const typeStr = row.leave_type?.type_name || 'Leave';
    const startStr = formatDisplayDate(row.start_date);
    const endStr = formatDisplayDate(row.end_date);
    const daysStr = `${row.working_days} ${row.working_days === 1 ? 'day' : 'days'}`;
    const statusStr = row.status || 'Pending';

    lines.push(
      `${i + 1}. ${nameStr}${typeStr} (${startStr} to ${endStr}, ${daysStr}) • **${statusStr}**`
    );
  }

  if (total > maxShown) {
    lines.push(`\n*${total - maxShown} more. Ask for a PDF to get all.*`);
  }

  return lines.join('\n');
};

/**
 * Handle BALANCE intent.
 */
const handleBalance = async (user) => {
  const b = await dataService.getBalance(user);
  return [
    `**Your Leave Balance:**`,
    `• Total Allocated: ${b.total} days`,
    `• Approved Leaves: ${b.approvedDays} days`,
    `• Pending Requests: ${b.pendingDays} days`,
    `• **Confirmed Remaining:** ${b.confirmedRemaining} days`,
    `• **Available Balance:** ${b.availableBalance} days (after pending)`,
  ].join('\n');
};

/**
 * Handle MY_LEAVES intent.
 */
const handleMyLeaves = async (user, entities = {}) => {
  const filters = {
    status: entities.status,
    from: entities.dates?.from,
    to: entities.dates?.to,
    month: entities.dates?.month,
    leave_type: entities.leaveType,
    limit: 10,
  };

  const exportFilters = {
    status: entities.status,
    from: entities.dates?.from,
    to: entities.dates?.to,
    month: entities.dates?.month,
    leave_type: entities.leaveType,
  };

  const result = await dataService.getMyLeaves(user, filters);
  storeUserList(user._id, result.rows, { filters: exportFilters, reportType: 'my_leaves' });

  let title = 'Your Leave Requests';
  if (entities.status) {
    title = `Your ${entities.status} Leaves`;
  }
  if (entities.dates?.resolvedString) {
    title += ` for ${entities.dates.resolvedString}`;
  }

  return formatLeavesList(result.rows, result.total, title);
};

/**
 * Handle LEAVE_STATUS intent.
 */
const handleLeaveStatus = async (user) => {
  const latest = await dataService.getLastLeaveStatus(user);
  if (!latest) {
    return 'You have not submitted any leave requests yet.';
  }

  const startStr = formatDisplayDate(latest.start_date);
  const endStr = formatDisplayDate(latest.end_date);
  const daysStr = `${latest.working_days} ${latest.working_days === 1 ? 'day' : 'days'}`;
  const appliedStr = formatDisplayDate(latest.applied_on);

  const lines = [
    `**Status of Your Latest Leave Request:**`,
    `• Type: ${latest.leave_type?.type_name || 'Leave'}`,
    `• Duration: ${startStr} to ${endStr} (${daysStr})`,
    `• Applied On: ${appliedStr}`,
    `• Status: **${latest.status}**`,
    `• Reason: ${latest.reason}`,
  ];

  if (latest.status === 'Rejected' && latest.rejection_reason) {
    lines.push(`• Rejection Reason: ${latest.rejection_reason}`);
  }

  return lines.join('\n');
};

/**
 * Handle LEAVE_TYPES intent.
 */
const handleLeaveTypes = async (user, entities = {}) => {
  const types = await dataService.getLeaveTypes();

  if (entities.leaveType) {
    const matched = types.find(
      (t) => t.type_name.toLowerCase() === entities.leaveType.toLowerCase()
    );
    if (matched) {
      return [
        `**${matched.type_name} Leave:**`,
        `• Maximum days per request: ${matched.max_days_per_request} working days`,
        `• Requirements: Minimum 10-character reason, weekends excluded.`,
      ].join('\n');
    }
  }

  const lines = ['**Available Company Leave Types:**'];
  for (const t of types) {
    lines.push(`• **${t.type_name} Leave**: Up to ${t.max_days_per_request} working days per request`);
  }
  lines.push('\n*All requests require a minimum 10-character reason and exclude weekends.*');
  return lines.join('\n');
};

/**
 * Handle PENDING_LIST intent (Admin only).
 */
const handlePendingList = async (user, entities = {}) => {
  try {
    const result = await dataService.getPendingLeaves(user, {
      department: entities.department,
      limit: 10,
    });

    storeUserList(user._id, result.rows, { filters: { department: entities.department }, reportType: 'pending_requests' });

    if (result.rows.length === 0) {
      return entities.department
        ? `There are no pending leave requests for the ${entities.department} department.`
        : 'There are currently no pending leave requests across the company.';
    }

    const title = entities.department
      ? `Pending Requests (${entities.department})`
      : 'All Pending Leave Requests';

    const lines = [`**${title}** (${result.total} total):`];
    result.rows.forEach((row, i) => {
      const name = row.employee_snapshot?.name || 'Employee';
      const dept = row.employee_snapshot?.department || '';
      const type = row.leave_type?.type_name || 'Leave';
      const start = formatDisplayDate(row.start_date);
      const end = formatDisplayDate(row.end_date);
      const days = `${row.working_days} ${row.working_days === 1 ? 'day' : 'days'}`;
      lines.push(`${i + 1}. ${name} (${dept}) — ${type} (${start} to ${end}, ${days})`);
    });

    if (result.total > result.rows.length) {
      lines.push(`\n*${result.total - result.rows.length} more. Ask for a PDF to get all.*`);
    }

    return lines.join('\n');
  } catch (err) {
    if (err instanceof dataService.PermissionDeniedError) {
      return 'Only administrators have permission to view all pending leave requests. You can check your own requests using "my pending leaves".';
    }
    throw err;
  }
};

/**
 * Handle DEPARTMENT_SUMMARY intent (Admin only).
 */
const handleDepartmentSummary = async (user, entities = {}) => {
  try {
    const from = entities.dates?.from;
    const to = entities.dates?.to;
    const status = entities.status || 'Approved';

    const summary = await dataService.getDepartmentSummary(user, { from, to, status });

    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    const periodLabel = entities.dates?.resolvedString
      ? ` for ${entities.dates.resolvedString}`
      : (from && to ? ` (${formatDisplayDate(from)} to ${formatDisplayDate(to)})` : '');

    if (!summary || summary.length === 0) {
      return `No ${statusLabel.toLowerCase()} leave records found across departments${periodLabel}.`;
    }

    const lines = [`**Department Leave Summary (${statusLabel} Leaves${periodLabel}):**`];
    for (const item of summary) {
      lines.push(
        `• **${item.department}**: ${item.totalDays} working days (${item.count} ${item.count === 1 ? 'request' : 'requests'})`
      );
    }
    return lines.join('\n');
  } catch (err) {
    if (err instanceof dataService.PermissionDeniedError) {
      return 'Only administrators have permission to view department leave summaries.';
    }
    throw err;
  }
};

/**
 * Handle MONTHLY_TREND intent (Admin only).
 */
const handleMonthlyTrend = async (user, entities = {}) => {
  try {
    const from = entities.dates?.from;
    const to = entities.dates?.to;
    const year = entities.dates?.year || (from ? Number(from.split('-')[0]) : null);
    const status = entities.status || 'Approved';

    const trend = await dataService.getMonthlyTrend(user, { year, from, to, status });
    const targetYear = year || trend[0]?.year || new Date().getFullYear();
    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
    const periodLabel = entities.dates?.resolvedString
      ? ` - ${entities.dates.resolvedString}`
      : ` (${targetYear})`;

    const lines = [`**Company Monthly Leave Trends (${statusLabel} Leaves${periodLabel}):**`];
    for (const m of trend) {
      if (m.totalDays > 0) {
        lines.push(`• **${m.month}**: ${m.totalDays} days (${m.count} ${m.count === 1 ? 'request' : 'requests'})`);
      }
    }

    if (lines.length === 1) {
      lines.push(`No ${statusLabel.toLowerCase()} leaves recorded for this period yet.`);
    }

    return lines.join('\n');
  } catch (err) {
    if (err instanceof dataService.PermissionDeniedError) {
      return 'Only administrators have permission to view company-wide monthly leave trends.';
    }
    throw err;
  }
};

/**
 * Handle WHO_IS_ON_LEAVE intent (Admin only).
 */
const handleWhoIsOnLeave = async (user, entities = {}) => {
  try {
    const result = await dataService.getWhoIsOnLeave(user, {
      from: entities.dates?.from,
      to: entities.dates?.to,
      limit: 10,
    });

    const windowText = entities.dates?.resolvedString || formatDisplayDate(result.window.from);

    if (result.rows.length === 0) {
      return `No employees are scheduled on leave for ${windowText}.`;
    }

    const lines = [`**Employees on leave for ${windowText}** (${result.total} total):`];
    result.rows.forEach((row, i) => {
      const name = row.employee_snapshot?.name || 'Employee';
      const dept = row.employee_snapshot?.department || '';
      const type = row.leave_type?.type_name || 'Leave';
      const start = formatDisplayDate(row.start_date);
      const end = formatDisplayDate(row.end_date);
      lines.push(`${i + 1}. **${name}** (${dept}) — ${type} (${start} to ${end})`);
    });

    if (result.total > result.rows.length) {
      lines.push(`\n*${result.total - result.rows.length} more. Ask for a PDF to get all.*`);
    }

    return lines.join('\n');
  } catch (err) {
    if (err instanceof dataService.PermissionDeniedError) {
      return 'Only administrators have permission to view who is on leave across the company.';
    }
    throw err;
  }
};

/**
 * Handle EMPLOYEE_LEAVES intent (Admin only).
 */
const handleEmployeeLeaves = async (user, entities = {}) => {
  if (user.role !== 'admin') {
    return 'Employees can only view their own leave requests. You can check yours using "my leaves".';
  }

  const targetIdentifier = entities.employee?.email || entities.employee?.name;
  if (!targetIdentifier) {
    return 'Please specify the employee name or email address whose leaves you want to view.';
  }

  const employee = await dataService.lookupEmployee(user, targetIdentifier);
  if (!employee) {
    return `Could not find an employee matching "${targetIdentifier}".`;
  }

  const result = await dataService.searchLeaves(user, {
    employee_id: employee._id,
    status: entities.status,
    from: entities.dates?.from,
    to: entities.dates?.to,
    leave_type: entities.leaveType,
    limit: 10,
  });

  storeUserList(user._id, result.rows, {
    filters: {
      employee_email: employee.email,
      status: entities.status,
      from: entities.dates?.from,
      to: entities.dates?.to,
      leave_type: entities.leaveType,
    },
    reportType: 'employee_report',
  });
  const title = `Leave Requests for ${employee.name} (${employee.department})`;
  return formatLeavesList(result.rows, result.total, title);
};

/**
 * Handle GREETING intent.
 */
const handleGreeting = (user) => {
  const name = user?.name ? user.name.split(' ')[0] : 'there';
  return `Hello, ${name}! How can I assist you with your leaves today? You can check your balance, view your leave requests, or inquire about company leave policies.`;
};

/**
 * Handle HELP intent (Role-aware).
 */
const handleHelp = (user) => {
  const isAdmin = user?.role === 'admin';
  const lines = [
    `**LeaveFlow Assistant Capabilities:**`,
    `• **Check Balance**: "What's my leave balance?", "How many leaves left?"`,
    `• **View Requests**: "Show my leaves", "My pending leaves in September"`,
    `• **Leave Status**: "Status of my last leave", "Was my leave approved?"`,
    `• **Policies & Types**: "What leave types are available?", "Max days for sick leave"`,
  ];

  if (isAdmin) {
    lines.push(
      `\n**Administrator Features:**`,
      `• **Pending Requests**: "Show pending requests"`,
      `• **Who Is Out**: "Who is on leave today?", "Who is out this week?"`,
      `• **Employee Leaves**: "Leaves of rohan@company.com"`,
      `• **Analytics**: "Department leave summary", "Monthly leave trend"`
    );
  }

  return lines.join('\n');
};

/**
 * Handle BULK_REFUSAL.
 */
const handleBulkRefusal = () => {
  return 'Bulk actions are not supported. Please review and manage leave requests one at a time.';
};

/**
 * Handle APPLY_LEAVE intent.
 */
const handleApplyLeave = async (user, entities = {}, rawText = '') => {
  // Extract reason if present after keywords
  let extractedReason = null;
  const reasonMatch = rawText.match(/(?:for|because|as|due to|reason:?)\s+(.+)$/i);
  if (reasonMatch) {
    const candidate = reasonMatch[1].trim();
    if (candidate.length >= 10) {
      extractedReason = candidate;
    }
  }

  const isHalfDay = /\bhalf\s*day\b/i.test(rawText);
  const slots = {
    leaveType: entities.leaveType || null,
    startDate: entities.dates?.from || null,
    endDate: entities.dates?.to || entities.dates?.from || null,
    isHalfDay,
    reason: extractedReason,
  };

  // Check missing slots
  if (!slots.leaveType) {
    setSlotState(user._id, { intent: 'APPLY_LEAVE', slots });
    return 'Which type of leave would you like to apply for? (Casual, Sick, or Paid)';
  }

  if (!slots.startDate || !slots.endDate) {
    setSlotState(user._id, { intent: 'APPLY_LEAVE', slots });
    return `For what date or date range would you like to take ${slots.leaveType} leave?`;
  }

  // Pre-validate dates
  try {
    await dataService.validateLeaveApplication(user, {
      leave_type_name: slots.leaveType,
      start_date: slots.startDate,
      end_date: slots.endDate,
      is_half_day: slots.isHalfDay,
      reason: undefined,
    });
  } catch (err) {
    slots.startDate = null;
    slots.endDate = null;
    setSlotState(user._id, { intent: 'APPLY_LEAVE', slots });
    return `${err.message}. Please provide a valid date or date range.`;
  }

  if (!slots.reason || slots.reason.trim().length < 10) {
    setSlotState(user._id, { intent: 'APPLY_LEAVE', slots });
    return 'Please provide a reason for your leave (at least 10 characters).';
  }

  // All slots present and valid -> clear slot filling draft
  clearSlotState(user._id);

  const validated = await dataService.validateLeaveApplication(user, {
    leave_type_name: slots.leaveType,
    start_date: slots.startDate,
    end_date: slots.endDate,
    is_half_day: slots.isHalfDay,
    reason: slots.reason,
  });

  const startDisplay = formatDisplayDate(slots.startDate);
  const endDisplay = formatDisplayDate(slots.endDate);
  const datesLine =
    slots.startDate === slots.endDate
      ? `${startDisplay} (${slots.startDate})`
      : `${startDisplay} (${slots.startDate}) to ${endDisplay} (${slots.endDate})`;

  const summary = [
    `• Leave Type: ${slots.leaveType} Leave`,
    `• Dates: ${datesLine}`,
    `• Working Days: ${validated.calculatedDays} ${validated.calculatedDays === 1 ? 'day' : 'days'}`,
    `• Half Day: ${slots.isHalfDay ? 'Yes' : 'No'}`,
    `• Reason: ${slots.reason}`,
  ].join('\n');

  const pendingAction = createPendingAction({
    userId: user._id,
    tool: 'apply_leave',
    args: {
      leave_type_name: slots.leaveType,
      start_date: slots.startDate,
      end_date: slots.endDate,
      is_half_day: slots.isHalfDay,
      reason: slots.reason,
    },
    summary,
  });

  return {
    reply: 'Please review and confirm your leave application below:',
    pendingAction,
  };
};

/**
 * Handle CANCEL_LEAVE intent.
 */
const handleCancelLeave = async (user, entities = {}) => {
  const result = await dataService.getMyLeaves(user, { status: 'Pending' });

  if (result.rows.length === 0) {
    return 'You have no pending leave requests to cancel.';
  }

  let target = null;

  if (entities.listIndex) {
    const list = getUserList(user._id);
    if (!list || list.length === 0) {
      return 'Please run "show my pending leaves" first to view and select from your requests.';
    }
    target = list.find((item) => item.index === entities.listIndex);
    if (!target) {
      return `Request #${entities.listIndex} was not found in your recent pending list.`;
    }
  } else if (entities.leaveId) {
    target = result.rows.find((r) => r._id.toString() === entities.leaveId);
    if (!target) {
      return `Could not find a pending leave with ID ${entities.leaveId}.`;
    }
  } else {
    if (result.rows.length === 1) {
      target = result.rows[0];
    } else {
      storeUserList(user._id, result.rows);
      const lines = [
        `You have ${result.rows.length} pending leave requests:`,
      ];
      result.rows.forEach((r, i) => {
        const type = r.leave_type?.type_name || 'Leave';
        const start = formatDisplayDate(r.start_date);
        const end = formatDisplayDate(r.end_date);
        const days = `${r.working_days} ${r.working_days === 1 ? 'day' : 'days'}`;
        lines.push(`${i + 1}. ${type} (${start} to ${end}, ${days})`);
      });
      lines.push('\nWhich leave request would you like to cancel? Reply with "cancel 1" or "cancel 2".');
      return lines.join('\n');
    }
  }

  const startDisplay = formatDisplayDate(target.start_date);
  const endDisplay = formatDisplayDate(target.end_date);
  const startIso = formatISODate(target.start_date);
  const endIso = formatISODate(target.end_date);
  const datesLine =
    startIso === endIso
      ? `${startDisplay} (${startIso})`
      : `${startDisplay} (${startIso}) to ${endDisplay} (${endIso})`;

  const summary = [
    `• Leave Type: ${target.leave_type?.type_name || target.leave_type} Leave`,
    `• Dates: ${datesLine}`,
    `• Working Days: ${target.working_days} ${target.working_days === 1 ? 'day' : 'days'}`,
    `• Reason: ${target.reason || 'None provided'}`,
  ].join('\n');

  const pendingAction = createPendingAction({
    userId: user._id,
    tool: 'cancel_leave',
    args: { leaveId: target._id.toString() },
    summary,
  });

  return {
    reply: 'Are you sure you want to cancel this leave request? Please confirm below:',
    pendingAction,
  };
};

/**
 * Handle APPROVE intent (Admin only).
 */
const handleApprove = async (user, entities = {}) => {
  if (user.role !== 'admin') {
    return 'Only administrators have permission to approve leave requests.';
  }

  let target = null;

  if (entities.listIndex) {
    const list = getUserList(user._id);
    if (!list || list.length === 0) {
      return 'Please run "show pending requests" first to view and select from the pending list.';
    }
    target = list.find((item) => item.index === entities.listIndex);
    if (!target) {
      return `Request #${entities.listIndex} was not found in your recent pending list.`;
    }
  } else if (entities.leaveId) {
    try {
      target = await dataService.getLeaveById(user, entities.leaveId);
    } catch {
      target = null;
    }
    if (!target) {
      return `Leave request with ID ${entities.leaveId} was not found.`;
    }
  } else {
    return 'Please specify which leave request to approve (e.g. "approve 1" after viewing pending requests).';
  }

  const impact = await dataService.checkApproveBalanceImpact(target._id);

  const startDisplay = formatDisplayDate(target.start_date);
  const endDisplay = formatDisplayDate(target.end_date);
  const startIso = formatISODate(target.start_date);
  const endIso = formatISODate(target.end_date);
  const datesLine =
    startIso === endIso
      ? `${startDisplay} (${startIso})`
      : `${startDisplay} (${startIso}) to ${endDisplay} (${endIso})`;

  const empName = target.employee_snapshot?.name || target.employee_name || impact?.employeeName || 'Employee';
  const dept = target.employee_snapshot?.department || target.department || impact?.department || '';

  const summaryLines = [
    `• Employee: ${empName}`,
    `• Department: ${dept}`,
    `• Leave Type: ${target.leave_type?.type_name || target.leave_type} Leave`,
    `• Dates: ${datesLine}`,
    `• Working Days: ${target.working_days} ${target.working_days === 1 ? 'day' : 'days'}`,
    `• Reason: ${target.reason || 'None provided'}`,
  ];

  if (impact?.isNegative) {
    summaryLines.push(
      `• ⚠️ **Warning**: Approving this request will reduce ${empName}'s available balance to ${impact.newBalance} days.`
    );
  }

  const pendingAction = createPendingAction({
    userId: user._id,
    tool: 'approve_leave',
    args: { leaveId: target._id.toString() },
    summary: summaryLines.join('\n'),
  });

  return {
    reply: 'Please review and confirm leave approval below:',
    pendingAction,
  };
};

/**
 * Handle REJECT intent (Admin only).
 */
const handleReject = async (user, entities = {}, rawText = '') => {
  if (user.role !== 'admin') {
    return 'Only administrators have permission to reject leave requests.';
  }

  let target = null;

  if (entities.listIndex) {
    const list = getUserList(user._id);
    if (!list || list.length === 0) {
      return 'Please run "show pending requests" first to view and select from the pending list.';
    }
    target = list.find((item) => item.index === entities.listIndex);
    if (!target) {
      return `Request #${entities.listIndex} was not found in your recent pending list.`;
    }
  } else if (entities.leaveId) {
    try {
      target = await dataService.getLeaveById(user, entities.leaveId);
    } catch {
      target = null;
    }
    if (!target) {
      return `Leave request with ID ${entities.leaveId} was not found.`;
    }
  } else {
    return 'Please specify which leave request to reject (e.g. "reject 1 because ...").';
  }

  // Extract rejection reason from message
  const reasonMatch = rawText.match(/(?:because|reason:?|due to|as)\s+(.+)$/i);
  const rejectionReason = reasonMatch ? reasonMatch[1].trim() : null;

  if (!rejectionReason) {
    setSlotState(user._id, {
      intent: 'REJECT',
      slots: {
        leaveId: target._id.toString(),
        listIndex: entities.listIndex,
      },
    });
    return 'Please provide a reason for rejecting this leave request.';
  }

  const startDisplay = formatDisplayDate(target.start_date);
  const endDisplay = formatDisplayDate(target.end_date);
  const startIso = formatISODate(target.start_date);
  const endIso = formatISODate(target.end_date);
  const datesLine =
    startIso === endIso
      ? `${startDisplay} (${startIso})`
      : `${startDisplay} (${startIso}) to ${endDisplay} (${endIso})`;

  const empName = target.employee_snapshot?.name || target.employee_name || 'Employee';
  const dept = target.employee_snapshot?.department || target.department || '';

  const summary = [
    `• Employee: ${empName}`,
    `• Department: ${dept}`,
    `• Leave Type: ${target.leave_type?.type_name || target.leave_type} Leave`,
    `• Dates: ${datesLine}`,
    `• Working Days: ${target.working_days} ${target.working_days === 1 ? 'day' : 'days'}`,
    `• Rejection Reason: ${rejectionReason}`,
  ].join('\n');

  const pendingAction = createPendingAction({
    userId: user._id,
    tool: 'reject_leave',
    args: { leaveId: target._id.toString(), rejectionReason },
    summary,
  });

  return {
    reply: 'Please review and confirm leave rejection below:',
    pendingAction,
  };
};

/**
 * Handle THANKS intent.
 */
const handleThanks = () => {
  return "You're very welcome! Let me know if you need any other assistance with your leaves.";
};

/**
 * Intent dispatch router.
 */
const executeHandler = async (intent, user, entities = {}, rawText = '') => {
  switch (intent) {
    case 'BALANCE':
      return await handleBalance(user);
    case 'MY_LEAVES':
      return await handleMyLeaves(user, entities);
    case 'LEAVE_STATUS':
      return await handleLeaveStatus(user);
    case 'LEAVE_TYPES':
      return await handleLeaveTypes(user, entities);
    case 'PENDING_LIST':
      return await handlePendingList(user, entities);
    case 'DEPARTMENT_SUMMARY':
      return await handleDepartmentSummary(user, entities);
    case 'MONTHLY_TREND':
      return await handleMonthlyTrend(user, entities);
    case 'WHO_IS_ON_LEAVE':
      return await handleWhoIsOnLeave(user, entities);
    case 'EMPLOYEE_LEAVES':
      return await handleEmployeeLeaves(user, entities);
    case 'BULK_REFUSAL':
      return handleBulkRefusal();
    case 'APPLY_LEAVE':
      return await handleApplyLeave(user, entities, rawText);
    case 'CANCEL_LEAVE':
      return await handleCancelLeave(user, entities);
    case 'APPROVE':
      return await handleApprove(user, entities);
    case 'REJECT':
      return await handleReject(user, entities, rawText);
    case 'GREETING':
      return handleGreeting(user);
    case 'HELP':
      return handleHelp(user);
    case 'THANKS':
      return handleThanks();
    case 'PDF_EXPORT':
      return await handlePdfExport(user, entities, rawText);
    default:
      return null;
  }
};

/**
 * Handle PDF_EXPORT intent.
 */
const handlePdfExport = async (user, entities = {}, rawText = '') => {
  try {
    const norm = (rawText || '').trim().toLowerCase();
    const isBare = /^(pdf|the pdf|give me (the )?pdf|download (the )?pdf|export (the )?pdf|make a pdf|report|the report|give me (a |the )?report|send me (a |the )?report|download (a |the )?report|export (a |the )?report)$/i.test(norm);

    let reportType = null;
    let filters = {};

    if (isBare) {
      const ctx = getUserListContext(user._id);
      if (ctx && ctx.reportType && (Date.now() - ctx.timestamp <= 5 * 60 * 1000)) {
        reportType = ctx.reportType;
        filters = { ...(ctx.filters || {}) };
        delete filters.limit;
      } else {
        setSlotState(user._id, { intent: 'PDF_EXPORT', slots: {} });
        return {
          reply: 'Which data should the PDF contain? For example: my leaves, my pending leaves, leaves in September.',
          source: 'rules',
        };
      }
    } else {
      const isDeptSummary = /\b(department summary|department report|departments? summary)\b/i.test(norm);
      const isPending = /\b(pending requests?|pending leaves?|pending)\b/i.test(norm) && !/\bmy pending\b/i.test(norm);
      const hasEmployee = Boolean(entities.employee?.email || entities.employee?.name);
      const isMyLeaves = /\bmy leaves?|my report\b/i.test(norm);

      if (isDeptSummary) {
        reportType = 'department_summary';
      } else if (isPending) {
        reportType = 'pending_requests';
      } else if (hasEmployee) {
        reportType = 'employee_report';
        filters.employee_email = entities.employee.email;
      } else if (user.role !== 'admin' || isMyLeaves) {
        reportType = 'my_leaves';
      } else {
        reportType = 'leave_list';
      }

      if (entities.department) filters.department = entities.department;
      if (entities.status) filters.status = entities.status;
      if (entities.leaveType) filters.leave_type = entities.leaveType;
      if (entities.dates?.from) filters.from = entities.dates.from;
      if (entities.dates?.to) filters.to = entities.dates.to;
    }

    const result = await pdfService.generatePdf({
      reportType,
      filters,
      user,
    });

    if (result.rowCount === 0) {
      return {
        reply: 'No matching leave records found for this report.',
        source: 'rules',
      };
    }

    return {
      reply: 'Your PDF report has been generated. Click below to download.',
      file: result.file,
      source: 'rules',
    };
  } catch (err) {
    if (err instanceof dataService.PermissionDeniedError) {
      return {
        reply: err.message || 'You do not have permission to generate this report.',
        source: 'rules',
      };
    }
    if (err.status === 429) {
      return {
        reply: err.message,
        source: 'rules',
      };
    }
    throw err;
  }
};

module.exports = {
  executeHandler,
  handleBalance,
  handleMyLeaves,
  handleLeaveStatus,
  handleLeaveTypes,
  handlePendingList,
  handleDepartmentSummary,
  handleMonthlyTrend,
  handleWhoIsOnLeave,
  handleEmployeeLeaves,
  handleBulkRefusal,
  handleApplyLeave,
  handleCancelLeave,
  handleApprove,
  handleReject,
  handleGreeting,
  handleHelp,
  handleThanks,
  handlePdfExport,
  formatLeavesList,
};
