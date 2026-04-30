const mongoose = require('mongoose');
const LeaveRequest = require('../models/LeaveRequest');
const Employee = require('../models/Employee');

// GET /api/analytics/dashboard — Employee personal stats
const getDashboard = async (req, res, next) => {
  try {
    const employeeId = req.user._id;

    // Balance via aggregation pipeline
    const balanceResult = await LeaveRequest.aggregate([
      { $match: { employee_ref: new mongoose.Types.ObjectId(employeeId) } },
      { $group: { _id: '$status', days: { $sum: '$working_days' } } },
    ]);

    const stats = { Approved: 0, Pending: 0, Rejected: 0 };
    balanceResult.forEach(r => { stats[r._id] = r.days; });

    // Monthly leave history for bar chart
    const monthlyHistory = await LeaveRequest.aggregate([
      {
        $match: {
          employee_ref: new mongoose.Types.ObjectId(employeeId),
          status: 'Approved',
          start_date: { $gte: new Date(new Date().getFullYear(), 0, 1) },
        },
      },
      {
        $group: {
          _id: { $month: '$start_date' },
          days: { $sum: '$working_days' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Leave type breakdown for pie chart
    const typeBreakdown = await LeaveRequest.aggregate([
      {
        $match: {
          employee_ref: new mongoose.Types.ObjectId(employeeId),
          status: { $in: ['Approved', 'Pending'] },
        },
      },
      {
        $group: {
          _id: '$leave_type.type_name',
          days: { $sum: '$working_days' },
          color: { $first: '$leave_type.color' },
        },
      },
    ]);

    // Recent 5 requests
    const recentRequests = await LeaveRequest.find({ employee_ref: employeeId })
      .sort({ applied_on: -1 })
      .limit(5);

    res.json({
      balance: {
        total: req.user.total_leaves,
        used: stats.Approved,
        pending: stats.Pending,
        remaining: req.user.total_leaves - stats.Approved - stats.Pending,
      },
      monthlyHistory,
      typeBreakdown,
      recentRequests,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/admin-dashboard
const getAdminDashboard = async (req, res, next) => {
  try {
    const totalEmployees = await Employee.countDocuments({ role: 'employee' });
    const pendingCount = await LeaveRequest.countDocuments({ status: 'Pending' });

    const now = new Date();
    const approvedThisMonth = await LeaveRequest.countDocuments({
      status: 'Approved',
      start_date: {
        $gte: new Date(now.getFullYear(), now.getMonth(), 1),
        $lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
      },
    });

    // Average balance across all employees (Efficiently calculated via aggregation)
    const statsResult = await Promise.all([
      LeaveRequest.aggregate([
        { $match: { status: { $in: ['Approved', 'Pending'] } } },
        { $group: { _id: null, totalUsed: { $sum: '$working_days' } } }
      ]),
      Employee.aggregate([
        { $match: { role: 'employee' } },
        { $group: { _id: null, totalAllocated: { $sum: '$total_leaves' } } }
      ])
    ]);

    const totalUsed = statsResult[0][0]?.totalUsed || 0;
    const totalAllocated = statsResult[1][0]?.totalAllocated || 0;
    const avgBalance = totalEmployees > 0 
      ? Math.round((totalAllocated - totalUsed) / totalEmployees) 
      : 0;

    // Top 5 employees by leave days taken
    const topEmployees = await LeaveRequest.aggregate([
      { $match: { status: 'Approved' } },
      {
        $group: {
          _id: '$employee_ref',
          name: { $first: '$employee_snapshot.name' },
          department: { $first: '$employee_snapshot.department' },
          totalDays: { $sum: '$working_days' },
        },
      },
      { $sort: { totalDays: -1 } },
      { $limit: 5 },
    ]);

    // Latest 3 pending
    const latestPending = await LeaveRequest.find({ status: 'Pending' })
      .sort({ applied_on: -1 })
      .limit(3);

    res.json({
      totalEmployees,
      pendingCount,
      approvedThisMonth,
      avgBalance,
      topEmployees,
      latestPending,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/monthly-trend
const getMonthlyTrend = async (req, res, next) => {
  try {
    const data = await LeaveRequest.aggregate([
      {
        $match: {
          status: 'Approved',
          start_date: { $gte: new Date(new Date().getFullYear(), 0, 1) },
        },
      },
      {
        $group: {
          _id: { $month: '$start_date' },
          totalDays: { $sum: '$working_days' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const formatted = data.map(d => ({
      month: months[d._id - 1],
      totalDays: d.totalDays,
      count: d.count,
    }));

    res.json(formatted);
  } catch (err) {
    next(err);
  }
};

// GET /api/analytics/department-summary
const getDepartmentSummary = async (req, res, next) => {
  try {
    // MongoDB Aggregation Pipeline — replaces SQL GROUP BY + JOIN
    const data = await LeaveRequest.aggregate([
      { $match: { status: 'Approved' } },
      {
        $group: {
          _id: '$employee_snapshot.department',
          totalDays: { $sum: '$working_days' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalDays: -1 } },
    ]);

    res.json(data.map(d => ({
      department: d._id,
      totalDays: d.totalDays,
      count: d.count,
    })));
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard, getAdminDashboard, getMonthlyTrend, getDepartmentSummary };
