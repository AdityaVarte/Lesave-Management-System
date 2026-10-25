const dataService = require('./dataService');
const pendingActions = require('./pendingActions');
const pdfService = require('./pdfService');
const { formatDisplayDate, formatISODate } = require('../utils/dateUtils');

const VALID_DEPARTMENTS = ['Engineering', 'Design', 'Finance', 'HR', 'Marketing', 'Operations'];
const VALID_STATUSES = ['Pending', 'Approved', 'Rejected'];

/**
 * Creates a per-request ID mapper that translates between MongoDB ObjectIds
 * and user/model-safe short references (e.g. "L1", "L2").
 */
const createIdMapper = () => {
  const refToId = new Map();
  const idToRef = new Map();
  let counter = 0;

  return {
    toModelRef(rawId) {
      if (!rawId) return null;
      const strId = rawId.toString();
      if (idToRef.has(strId)) {
        return idToRef.get(strId);
      }
      counter += 1;
      const ref = `L${counter}`;
      refToId.set(ref, strId);
      idToRef.set(strId, ref);
      return ref;
    },
    toRealId(refOrId) {
      if (!refOrId) return null;
      const clean = String(refOrId).trim();
      if (refToId.has(clean)) {
        return refToId.get(clean);
      }
      if (idToRef.has(clean)) {
        return clean;
      }
      return null;
    },
    hasRef(ref) {
      return refToId.has(String(ref).trim());
    },
  };
};

/**
 * Gemini Function Declarations Schema definitions.
 */
const TOOL_DEFINITIONS = [
  {
    name: 'get_my_leave_balance',
    description: "Get the authenticated user's current leave balance (allocated, approved, pending, confirmed remaining, and available balance).",
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'list_my_leaves',
    description: "List the authenticated user's own leave requests with optional filters.",
    parameters: {
      type: 'OBJECT',
      properties: {
        status: {
          type: 'STRING',
          description: 'Filter by request status: Pending, Approved, or Rejected',
          enum: VALID_STATUSES,
        },
        from: {
          type: 'STRING',
          description: 'Start of date range in YYYY-MM-DD format',
        },
        to: {
          type: 'STRING',
          description: 'End of date range in YYYY-MM-DD format',
        },
        month: {
          type: 'STRING',
          description: 'Filter by specific month in YYYY-MM format',
        },
        leave_type: {
          type: 'STRING',
          description: 'Filter by leave type name (e.g. Casual, Sick, Paid)',
        },
        limit: {
          type: 'INTEGER',
          description: 'Maximum number of items to return (1-200, default 10)',
        },
      },
    },
  },
  {
    name: 'search_leaves',
    description: 'Search leave requests. Employees can only search their own leaves. Admins can search across departments and employees.',
    parameters: {
      type: 'OBJECT',
      properties: {
        employee_email: {
          type: 'STRING',
          description: 'Admin only: Filter by employee email address',
        },
        department: {
          type: 'STRING',
          description: 'Admin only: Filter by department',
          enum: VALID_DEPARTMENTS,
        },
        status: {
          type: 'STRING',
          description: 'Filter by request status: Pending, Approved, or Rejected',
          enum: VALID_STATUSES,
        },
        from: {
          type: 'STRING',
          description: 'Start date in YYYY-MM-DD format',
        },
        to: {
          type: 'STRING',
          description: 'End date in YYYY-MM-DD format',
        },
        leave_type: {
          type: 'STRING',
          description: 'Filter by leave type name',
        },
        limit: {
          type: 'INTEGER',
          description: 'Max records (1-200, default 10)',
        },
      },
    },
  },
  {
    name: 'list_leave_types',
    description: 'Get all available company leave types, rules, and maximum days per request.',
    parameters: {
      type: 'OBJECT',
      properties: {},
    },
  },
  {
    name: 'get_pending_leaves',
    description: 'Admin only: List all pending leave requests across the company awaiting review.',
    parameters: {
      type: 'OBJECT',
      properties: {
        department: {
          type: 'STRING',
          description: 'Filter by department',
          enum: VALID_DEPARTMENTS,
        },
        limit: {
          type: 'INTEGER',
          description: 'Max records (1-200, default 10)',
        },
      },
    },
  },
  {
    name: 'get_department_summary',
    description: 'Admin only: Get aggregated leave statistics and summary across departments with optional period and status filters.',
    parameters: {
      type: 'OBJECT',
      properties: {
        from: {
          type: 'STRING',
          description: 'Start date in YYYY-MM-DD format',
        },
        to: {
          type: 'STRING',
          description: 'End date in YYYY-MM-DD format',
        },
        status: {
          type: 'STRING',
          description: 'Filter by request status: Pending, Approved, or Rejected',
          enum: VALID_STATUSES,
        },
      },
    },
  },
  {
    name: 'get_monthly_trend',
    description: 'Admin only: Get monthly breakdown of leave requests and days taken with optional year, period and status filters.',
    parameters: {
      type: 'OBJECT',
      properties: {
        year: {
          type: 'INTEGER',
          description: 'Calendar year to query (e.g. 2026)',
        },
        from: {
          type: 'STRING',
          description: 'Start date in YYYY-MM-DD format',
        },
        to: {
          type: 'STRING',
          description: 'End date in YYYY-MM-DD format',
        },
        status: {
          type: 'STRING',
          description: 'Filter by request status: Pending, Approved, or Rejected',
          enum: VALID_STATUSES,
        },
      },
    },
  },
  {
    name: 'who_is_on_leave',
    description: 'Admin only: Query which employees are approved to be on leave on a given date or window.',
    parameters: {
      type: 'OBJECT',
      properties: {
        date: {
          type: 'STRING',
          description: 'Specific date in YYYY-MM-DD format (defaults to today)',
        },
        department: {
          type: 'STRING',
          description: 'Optional department filter',
          enum: VALID_DEPARTMENTS,
        },
      },
    },
  },
  {
    name: 'lookup_employee',
    description: 'Admin only: Search employee profile and leave quota by email or name.',
    parameters: {
      type: 'OBJECT',
      properties: {
        identifier: {
          type: 'STRING',
          description: 'Employee email address or exact name',
        },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'apply_leave',
    description: 'Create a draft leave request confirmation card for the authenticated user. Note: This creates a confirmation card for the user to review and confirm; it does not write directly to the database.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leave_type_name: {
          type: 'STRING',
          description: 'Leave type (Casual, Sick, or Paid)',
        },
        start_date: {
          type: 'STRING',
          description: 'Start date in YYYY-MM-DD format',
        },
        end_date: {
          type: 'STRING',
          description: 'End date in YYYY-MM-DD format (same as start_date for single day)',
        },
        reason: {
          type: 'STRING',
          description: 'Explanation for leave request (minimum 10 characters)',
        },
        is_half_day: {
          type: 'BOOLEAN',
          description: 'Whether this request is for a half working day',
        },
      },
      required: ['leave_type_name', 'start_date', 'end_date', 'reason'],
    },
  },
  {
    name: 'cancel_leave',
    description: 'Create a confirmation card to cancel a pending leave request. The user must click confirm to execute cancellation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leave_id: {
          type: 'STRING',
          description: 'Leave reference identifier (e.g. "L1", "L2")',
        },
      },
      required: ['leave_id'],
    },
  },
  {
    name: 'approve_leave',
    description: 'Admin only: Create a confirmation card to approve a pending leave request. The administrator must click confirm to execute.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leave_id: {
          type: 'STRING',
          description: 'Leave reference identifier (e.g. "L1", "L2")',
        },
      },
      required: ['leave_id'],
    },
  },
  {
    name: 'reject_leave',
    description: 'Admin only: Create a confirmation card to reject a pending leave request with a stated reason.',
    parameters: {
      type: 'OBJECT',
      properties: {
        leave_id: {
          type: 'STRING',
          description: 'Leave reference identifier (e.g. "L1", "L2")',
        },
        rejection_reason: {
          type: 'STRING',
          description: 'Reason for rejecting this request',
        },
      },
      required: ['leave_id', 'rejection_reason'],
    },
  },
  {
    name: 'generate_leave_pdf',
    description: 'Generate a downloadable formal PDF report for leave records.',
    parameters: {
      type: 'OBJECT',
      properties: {
        report_type: {
          type: 'STRING',
          description: 'Type of report',
          enum: ['my_leaves', 'leave_list', 'pending_requests', 'department_summary', 'employee_report'],
        },
        department: {
          type: 'STRING',
          description: 'Optional department filter',
          enum: VALID_DEPARTMENTS,
        },
        status: {
          type: 'STRING',
          description: 'Optional status filter: Pending, Approved, or Rejected',
          enum: VALID_STATUSES,
        },
        leave_type: {
          type: 'STRING',
          description: 'Optional leave type filter',
        },
        from: {
          type: 'STRING',
          description: 'Start date in YYYY-MM-DD format',
        },
        to: {
          type: 'STRING',
          description: 'End date in YYYY-MM-DD format',
        },
        employee_email: {
          type: 'STRING',
          description: 'Admin only: Filter by employee email',
        },
      },
      required: ['report_type'],
    },
  },
];

/**
 * Format raw leave records for Gemini consumption:
 * 1. Replaces Mongo _id with short reference ("L1", "L2").
 * 2. Formats dates in Asia/Calcutta ISO (YYYY-MM-DD).
 * 3. Drops internal fields, passwords, and sensitive tokens.
 * 4. Caps row count at 50 with truncation metadata.
 */
const sanitizeLeaveRows = (rows, idMapper, totalCount = null) => {
  if (!Array.isArray(rows)) return [];
  const maxRows = 50;
  const isTruncated = rows.length > maxRows || (totalCount !== null && totalCount > maxRows);
  const sliced = rows.slice(0, maxRows);

  const formattedRows = sliced.map((r) => {
    const rawId = r._id?.toString() || r.id;
    const modelRef = idMapper.toModelRef(rawId);

    return {
      leave_ref: modelRef,
      employee_name: r.employee_snapshot?.name || r.employee_name || 'Employee',
      department: r.employee_snapshot?.department || r.department || '',
      leave_type: r.leave_type?.type_name || r.leave_type || 'Leave',
      start_date: formatISODate(r.start_date),
      end_date: formatISODate(r.end_date),
      working_days: r.working_days,
      is_half_day: Boolean(r.is_half_day),
      status: r.status,
      reason: r.reason || '',
      rejection_reason: r.rejection_reason || null,
    };
  });

  return {
    records: formattedRows,
    totalCount: totalCount !== null ? totalCount : rows.length,
    returnedCount: formattedRows.length,
    truncated: isTruncated,
    notice: isTruncated ? 'Data capped at 50 records for privacy and context limits.' : null,
  };
};

/**
 * Validate and clean tool input arguments.
 */
const validateToolArgs = (toolName, rawArgs) => {
  const args = typeof rawArgs === 'object' && rawArgs !== null ? { ...rawArgs } : {};

  // Validate dates (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  for (const key of ['from', 'to', 'start_date', 'end_date', 'date']) {
    if (args[key]) {
      if (typeof args[key] !== 'string' || !dateRegex.test(args[key].trim())) {
        throw new Error(`Invalid date format for '${key}'. Expected YYYY-MM-DD.`);
      }
      args[key] = args[key].trim();
    }
  }

  // Validate department enum
  if (args.department) {
    if (!VALID_DEPARTMENTS.includes(args.department)) {
      throw new Error(`Invalid department '${args.department}'. Allowed: ${VALID_DEPARTMENTS.join(', ')}`);
    }
  }

  // Validate status enum
  if (args.status) {
    if (!VALID_STATUSES.includes(args.status)) {
      throw new Error(`Invalid status '${args.status}'. Allowed: ${VALID_STATUSES.join(', ')}`);
    }
  }

  // Validate limit (1 - 200, default 10)
  if (args.limit !== undefined) {
    const num = parseInt(args.limit, 10);
    if (isNaN(num) || num < 1) {
      args.limit = 10;
    } else {
      args.limit = Math.min(num, 200);
    }
  } else {
    args.limit = 10;
  }

  return args;
};

/**
 * Execute a tool call requested by Gemini.
 * Role scoping stays inside dataService and is re-verified here.
 * Never executes write operations directly — only produces pendingAction cards.
 *
 * @param {string} toolName
 * @param {object} rawArgs
 * @param {object} user - Authenticated user
 * @param {object} context - Request execution context { idMapper, setPendingAction }
 * @returns {Promise<object>} Structured data output for Gemini
 */
const executeToolCall = async (toolName, rawArgs, user, context) => {
  const { idMapper, setPendingAction } = context;

  try {
    const args = validateToolArgs(toolName, rawArgs);

    switch (toolName) {
      // ─── READ TOOLS ────────────────────────────────────────────────────────

      case 'get_my_leave_balance': {
        const balance = await dataService.getBalance(user);
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: {
            employee: user.name,
            totalAllocated: balance.total,
            approvedDays: balance.approvedDays,
            pendingDays: balance.pendingDays,
            confirmedRemaining: balance.confirmedRemaining,
            availableBalance: balance.availableBalance,
          },
        };
      }

      case 'list_my_leaves': {
        const res = await dataService.getMyLeaves(user, {
          status: args.status,
          from: args.from,
          to: args.to,
          month: args.month,
          leave_type: args.leave_type,
          limit: args.limit,
        });
        const sanitized = sanitizeLeaveRows(res.rows, idMapper, res.total);
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: sanitized,
        };
      }

      case 'search_leaves': {
        const res = await dataService.searchLeaves(user, {
          employee_email: args.employee_email,
          department: args.department,
          status: args.status,
          from: args.from,
          to: args.to,
          leave_type: args.leave_type,
          limit: args.limit,
        });
        const sanitized = sanitizeLeaveRows(res.rows, idMapper, res.total);
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: sanitized,
        };
      }

      case 'list_leave_types': {
        const types = await dataService.getLeaveTypes();
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: types.map((t) => ({
            name: t.type_name,
            max_days_per_request: t.max_days_per_request,
            policy: 'Requires minimum 10-character reason; weekends excluded.',
          })),
        };
      }

      case 'get_pending_leaves': {
        if (user.role !== 'admin') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: 'Access denied: Admin permission required to view company pending leaves.',
          };
        }
        const res = await dataService.getPendingLeaves(user, {
          department: args.department,
          limit: args.limit,
        });
        const sanitized = sanitizeLeaveRows(res.rows, idMapper, res.total);
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: sanitized,
        };
      }

      case 'get_department_summary': {
        if (user.role !== 'admin') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: 'Access denied: Admin permission required to view department summaries.',
          };
        }
        const summary = await dataService.getDepartmentSummary(user, {
          from: args.from,
          to: args.to,
          status: args.status,
        });
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: summary,
        };
      }

      case 'get_monthly_trend': {
        if (user.role !== 'admin') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: 'Access denied: Admin permission required to view monthly trends.',
          };
        }
        const trend = await dataService.getMonthlyTrend(user, {
          year: args.year,
          from: args.from,
          to: args.to,
          status: args.status,
        });
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: trend,
        };
      }

      case 'who_is_on_leave': {
        if (user.role !== 'admin') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: 'Access denied: Admin permission required to view who is on leave.',
          };
        }
        const res = await dataService.getWhoIsOnLeave(user, {
          from: args.date,
          to: args.date,
          limit: 50,
        });
        const sanitized = sanitizeLeaveRows(res.rows, idMapper, res.total);
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: sanitized,
        };
      }

      case 'lookup_employee': {
        if (user.role !== 'admin') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: 'Access denied: Admin permission required to lookup employees.',
          };
        }
        if (!args.identifier) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: 'Employee identifier (email or name) is required.',
          };
        }
        const emp = await dataService.lookupEmployee(user, args.identifier);
        if (!emp) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            untrustedTextFields: true,
            content: { found: false, message: `No employee found matching '${args.identifier}'.` },
          };
        }
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: {
            found: true,
            name: emp.name,
            email: emp.email,
            department: emp.department,
            role: emp.role,
            total_leaves: emp.total_leaves,
          },
        };
      }

      // ─── WRITE TOOLS (NEVER WRITES TO DB, CREATES PENDING ACTION ONLY) ──────

      case 'apply_leave': {
        const validated = await dataService.validateLeaveApplication(user, {
          leave_type_name: args.leave_type_name,
          start_date: args.start_date,
          end_date: args.end_date,
          reason: args.reason,
          is_half_day: args.is_half_day,
        });

        const startDisplay = formatDisplayDate(args.start_date);
        const endDisplay = formatDisplayDate(args.end_date);
        const datesLine =
          args.start_date === args.end_date
            ? `${startDisplay} (${args.start_date})`
            : `${startDisplay} (${args.start_date}) to ${endDisplay} (${args.end_date})`;

        const summary = [
          `• Leave Type: ${args.leave_type_name} Leave`,
          `• Dates: ${datesLine}`,
          `• Working Days: ${validated.calculatedDays} ${validated.calculatedDays === 1 ? 'day' : 'days'}`,
          `• Half Day: ${args.is_half_day ? 'Yes' : 'No'}`,
          `• Reason: ${args.reason}`,
        ].join('\n');

        const pendingAction = pendingActions.createPendingAction({
          userId: user._id,
          tool: 'apply_leave',
          args: {
            leave_type_name: args.leave_type_name,
            start_date: args.start_date,
            end_date: args.end_date,
            reason: args.reason,
            is_half_day: Boolean(args.is_half_day),
          },
          summary,
        });

        setPendingAction(pendingAction);

        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          action: 'PENDING_CONFIRMATION_CARD_CREATED',
          tool: 'apply_leave',
          summary,
          message: 'A confirmation card has been generated for the user to review and confirm their leave application.',
        };
      }

      case 'cancel_leave': {
        const realId = idMapper.toRealId(args.leave_id);
        if (!realId) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: `Invalid or unmapped leave reference: '${args.leave_id}'. Please query your leaves first to get a valid reference.`,
          };
        }

        const leave = await dataService.getLeaveById(user, realId);
        if (!leave) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: `Leave request '${args.leave_id}' not found.`,
          };
        }

        if (leave.status !== 'Pending') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: `Cannot cancel leave: current status is '${leave.status}'. Only pending leaves can be cancelled.`,
          };
        }

        const startDisplay = formatDisplayDate(leave.start_date);
        const endDisplay = formatDisplayDate(leave.end_date);
        const startIso = formatISODate(leave.start_date);
        const endIso = formatISODate(leave.end_date);
        const datesLine =
          startIso === endIso
            ? `${startDisplay} (${startIso})`
            : `${startDisplay} (${startIso}) to ${endDisplay} (${endIso})`;

        const summary = [
          `• Leave Type: ${leave.leave_type?.type_name || leave.leave_type} Leave`,
          `• Dates: ${datesLine}`,
          `• Working Days: ${leave.working_days} ${leave.working_days === 1 ? 'day' : 'days'}`,
          `• Reason: ${leave.reason || 'None provided'}`,
        ].join('\n');

        const pendingAction = pendingActions.createPendingAction({
          userId: user._id,
          tool: 'cancel_leave',
          args: { leaveId: realId },
          summary,
        });

        setPendingAction(pendingAction);

        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          action: 'PENDING_CONFIRMATION_CARD_CREATED',
          tool: 'cancel_leave',
          summary,
          message: 'A confirmation card has been generated for the user to confirm cancellation.',
        };
      }

      case 'approve_leave': {
        if (user.role !== 'admin') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: 'Access denied: Admin permission required to approve leave requests.',
          };
        }

        const realId = idMapper.toRealId(args.leave_id);
        if (!realId) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: `Invalid or unmapped leave reference: '${args.leave_id}'. Please query pending requests first.`,
          };
        }

        const target = await dataService.getLeaveById(user, realId);
        if (!target) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: `Leave request '${args.leave_id}' was not found.`,
          };
        }

        if (target.status !== 'Pending') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: `Leave request is already '${target.status}'. Only pending requests can be approved.`,
          };
        }

        const impact = await dataService.checkApproveBalanceImpact(realId);
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

        const pendingAction = pendingActions.createPendingAction({
          userId: user._id,
          tool: 'approve_leave',
          args: { leaveId: realId },
          summary: summaryLines.join('\n'),
        });

        setPendingAction(pendingAction);

        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          action: 'PENDING_CONFIRMATION_CARD_CREATED',
          tool: 'approve_leave',
          summary: summaryLines.join('\n'),
          message: 'A confirmation card has been generated for the administrator to review and confirm approval.',
        };
      }

      case 'reject_leave': {
        if (user.role !== 'admin') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: 'Access denied: Admin permission required to reject leave requests.',
          };
        }

        const realId = idMapper.toRealId(args.leave_id);
        if (!realId) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: `Invalid or unmapped leave reference: '${args.leave_id}'. Please query pending requests first.`,
          };
        }

        if (!args.rejection_reason || typeof args.rejection_reason !== 'string' || !args.rejection_reason.trim()) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: 'Rejection reason is required.',
          };
        }

        const target = await dataService.getLeaveById(user, realId);
        if (!target) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: `Leave request '${args.leave_id}' was not found.`,
          };
        }

        if (target.status !== 'Pending') {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            error: `Leave request is already '${target.status}'. Only pending requests can be rejected.`,
          };
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
          `• Rejection Reason: ${args.rejection_reason.trim()}`,
        ].join('\n');

        const pendingAction = pendingActions.createPendingAction({
          userId: user._id,
          tool: 'reject_leave',
          args: { leaveId: realId, rejectionReason: args.rejection_reason.trim() },
          summary,
        });

        setPendingAction(pendingAction);

        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          action: 'PENDING_CONFIRMATION_CARD_CREATED',
          tool: 'reject_leave',
          summary,
          message: 'A confirmation card has been generated for the administrator to review and confirm rejection.',
        };
      }

      case 'generate_leave_pdf': {
        const reportType = args.report_type || (user.role === 'admin' ? 'leave_list' : 'my_leaves');
        const pdfRes = await pdfService.generatePdf({
          reportType,
          filters: args,
          user,
        });

        if (pdfRes.rowCount === 0) {
          return {
            dataType: 'LEAVE_MANAGEMENT_DATA',
            untrustedTextFields: true,
            content: {
              success: false,
              message: 'No matching records found to generate a PDF report.',
            },
          };
        }

        if (context.setFilePayload) {
          context.setFilePayload(pdfRes.file);
        }

        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          untrustedTextFields: true,
          content: {
            success: true,
            fileName: pdfRes.file.name,
            rowCount: pdfRes.file.rows,
            totalCount: pdfRes.file.totalCount,
            truncated: pdfRes.file.truncated,
            reportRef: pdfRes.file.reportRef,
            notice: 'Report generated and delivered to user download card.',
          },
        };
      }

      default:
        return {
          dataType: 'LEAVE_MANAGEMENT_DATA',
          error: `Unknown tool '${toolName}'.`,
        };
    }
  } catch (err) {
    return {
      dataType: 'LEAVE_MANAGEMENT_DATA',
      error: err.message || 'Error executing tool',
    };
  }
};

module.exports = {
  TOOL_DEFINITIONS,
  executeToolCall,
  createIdMapper,
  validateToolArgs,
  sanitizeLeaveRows,
};
