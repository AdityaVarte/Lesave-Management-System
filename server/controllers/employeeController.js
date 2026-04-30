const mongoose = require('mongoose');
const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');

// Helper: get leave balance for an employee
const getEmployeeBalance = async (employeeId) => {
  const result = await LeaveRequest.aggregate([
    { $match: { employee_ref: new mongoose.Types.ObjectId(employeeId) } },
    { $group: { _id: '$status', days: { $sum: '$working_days' } } },
  ]);

  const stats = { Approved: 0, Pending: 0, Rejected: 0 };
  result.forEach(r => { stats[r._id] = r.days; });
  return stats;
};

// GET /api/employees
const getAllEmployees = async (req, res, next) => {
  try {
    const employees = await Employee.find().select('-password').sort({ createdAt: -1 });

    const employeesWithBalance = await Promise.all(
      employees.map(async (emp) => {
        const stats = await getEmployeeBalance(emp._id);
        return {
          ...emp.toObject(),
          balance: {
            total: emp.total_leaves,
            used: stats.Approved,
            pending: stats.Pending,
            remaining: emp.total_leaves - stats.Approved - stats.Pending,
          },
        };
      })
    );

    res.json(employeesWithBalance);
  } catch (err) {
    next(err);
  }
};

// GET /api/employees/:id
const getEmployee = async (req, res, next) => {
  try {
    const emp = await Employee.findById(req.params.id).select('-password');
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    // Allow employee to get only their own profile
    if (req.user.role !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const stats = await getEmployeeBalance(emp._id);
    res.json({
      ...emp.toObject(),
      balance: {
        total: emp.total_leaves,
        used: stats.Approved,
        pending: stats.Pending,
        remaining: emp.total_leaves - stats.Approved - stats.Pending,
      },
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/employees
const createEmployee = async (req, res, next) => {
  try {
    const { name, email, department, role, total_leaves, password } = req.body;
    const emp = new Employee({ name, email, department, role, total_leaves, password });
    await emp.save();
    const empObj = emp.toObject();
    delete empObj.password;
    res.status(201).json(empObj);
  } catch (err) {
    next(err);
  }
};

// PUT /api/employees/:id
const updateEmployee = async (req, res, next) => {
  try {
    const { name, email, department, role, total_leaves, password } = req.body;
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    emp.name = name || emp.name;
    emp.email = email || emp.email;
    emp.department = department || emp.department;
    emp.role = role || emp.role;
    emp.total_leaves = total_leaves || emp.total_leaves;

    // Only re-hash if password explicitly changed
    if (password && password.trim() !== '') {
      emp.password = password; // pre-save hook will hash it
    }

    await emp.save();
    const empObj = emp.toObject();
    delete empObj.password;
    res.json(empObj);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/employees/:id
const deleteEmployee = async (req, res, next) => {
  try {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: 'Employee not found' });

    // Block deletion if employee has Pending or Approved leaves
    const activeLeaves = await LeaveRequest.findOne({
      employee_ref: req.params.id,
      status: { $in: ['Pending', 'Approved'] },
    });

    if (activeLeaves) {
      return res.status(400).json({
        message: 'Cannot delete employee with active or pending leave requests',
      });
    }

    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee };
