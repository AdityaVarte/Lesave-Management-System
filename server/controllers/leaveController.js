const mongoose = require('mongoose');
const LeaveRequest = require('../models/LeaveRequest');
const Employee = require('../models/Employee');
const LeaveType = require('../models/LeaveType');

const { calcWorkingDays } = require('../utils/workingDays');

// GET /api/leaves
const getLeaves = async (req, res, next) => {
  try {
    const { status, type, department, month, page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user.role !== 'admin') {
      query.employee_ref = req.user._id;
    }
    if (status) query.status = status;
    if (type) query['leave_type.type_name'] = type;
    if (department) query['employee_snapshot.department'] = department;
    if (month) {
      const [year, mon] = month.split('-');
      query.start_date = {
        $gte: new Date(year, mon - 1, 1),
        $lt: new Date(year, mon, 1),
      };
    }

    const total = await LeaveRequest.countDocuments(query);
    const leaves = await LeaveRequest.find(query)
      .sort({ applied_on: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({
      leaves,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/leaves/pending
const getPendingLeaves = async (req, res, next) => {
  try {
    const leaves = await LeaveRequest.find({ status: 'Pending' }).sort({ applied_on: -1 });
    res.json(leaves);
  } catch (err) {
    next(err);
  }
};

// GET /api/leaves/:id
const getLeave = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave request not found' });

    if (req.user.role !== 'admin' && leave.employee_ref.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(leave);
  } catch (err) {
    next(err);
  }
};

// POST /api/leaves
const applyLeave = async (req, res, next) => {
  try {
    const { employee_id, leave_type_id, start_date, end_date, is_half_day, reason } = req.body;

    // Determine which employee is applying
    const employeeId = req.user.role === 'admin' && employee_id
      ? employee_id
      : req.user._id.toString();

    const employee = await Employee.findById(employeeId);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    const leaveType = await LeaveType.findById(leave_type_id);
    if (!leaveType) return res.status(404).json({ message: 'Leave type not found' });

    // CHECK 1: Past date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(start_date) < today) {
      return res.status(400).json({ message: 'Start date cannot be in the past' });
    }

    // CHECK 2: End before start
    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({ message: 'End date must be on or after start date' });
    }

    // CHECK 3: Max 30 working days
    const calculatedDays = calcWorkingDays(start_date, end_date, is_half_day);
    if (calculatedDays > 30) {
      return res.status(400).json({ message: 'Single request cannot exceed 30 working days' });
    }

    // CHECK 4: Overlap detection
    const overlap = await LeaveRequest.findOne({
      employee_ref: employeeId,
      status: { $ne: 'Rejected' },
      start_date: { $lte: new Date(end_date) },
      end_date:   { $gte: new Date(start_date) },
    });
    if (overlap) {
      return res.status(400).json({
        message: `Leave dates overlap with an existing ${overlap.status} request`,
      });
    }

    // CHECK 5: Balance check via aggregation pipeline
    const result = await LeaveRequest.aggregate([
      {
        $match: {
          employee_ref: new mongoose.Types.ObjectId(employeeId),
          status: { $in: ['Approved', 'Pending'] },
        },
      },
      { $group: { _id: null, used: { $sum: '$working_days' } } },
    ]);
    const used = result[0]?.used || 0;
    const remaining = employee.total_leaves - used;
    if (calculatedDays > remaining) {
      return res.status(400).json({
        message: `Insufficient balance: ${remaining} days available, ${calculatedDays} days requested`,
      });
    }

    // CHECK 6: Reason length
    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ message: 'Reason must be at least 10 characters' });
    }

    // Create leave request (pre-save hook calculates working_days)
    const leaveRequest = new LeaveRequest({
      employee_ref: employeeId,
      employee_snapshot: {
        name: employee.name,
        email: employee.email,
        department: employee.department,
      },
      leave_type: {
        type_id:   leaveType._id,
        type_name: leaveType.type_name,
        color:     leaveType.color,
      },
      start_date,
      end_date,
      is_half_day: is_half_day || false,
      reason: reason.trim(),
    });

    await leaveRequest.save();
    res.status(201).json(leaveRequest);
  } catch (err) {
    next(err);
  }
};

// PUT /api/leaves/:id/approve
const approveLeave = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending leaves can be approved' });
    }
    leave.status = 'Approved';
    await leave.save();
    res.json(leave);
  } catch (err) {
    next(err);
  }
};

// PUT /api/leaves/:id/reject
const rejectLeave = async (req, res, next) => {
  try {
    const { rejection_reason } = req.body;
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending leaves can be rejected' });
    }
    leave.status = 'Rejected';
    leave.rejection_reason = rejection_reason || 'No reason provided';
    await leave.save();
    res.json(leave);
  } catch (err) {
    next(err);
  }
};

// PUT /api/leaves/:id/cancel
const cancelLeave = async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.employee_ref.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only cancel your own leaves' });
    }
    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Only pending leaves can be cancelled' });
    }
    await LeaveRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Leave cancelled successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLeaves, getPendingLeaves, getLeave, applyLeave, approveLeave, rejectLeave, cancelLeave };
