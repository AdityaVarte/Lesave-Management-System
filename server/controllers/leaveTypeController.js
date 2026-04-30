const LeaveType = require('../models/LeaveType');

// GET /api/leave-types
const getLeaveTypes = async (req, res, next) => {
  try {
    const types = await LeaveType.find().sort({ type_name: 1 });
    res.json(types);
  } catch (err) {
    next(err);
  }
};

// POST /api/leave-types
const createLeaveType = async (req, res, next) => {
  try {
    const { type_name, max_days_per_request, color } = req.body;
    const leaveType = new LeaveType({ type_name, max_days_per_request, color });
    await leaveType.save();
    res.status(201).json(leaveType);
  } catch (err) {
    next(err);
  }
};

// PUT /api/leave-types/:id
const updateLeaveType = async (req, res, next) => {
  try {
    const { type_name, max_days_per_request, color } = req.body;
    const leaveType = await LeaveType.findByIdAndUpdate(
      req.params.id,
      { type_name, max_days_per_request, color },
      { new: true, runValidators: true }
    );
    if (!leaveType) return res.status(404).json({ message: 'Leave type not found' });
    res.json(leaveType);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/leave-types/:id
const deleteLeaveType = async (req, res, next) => {
  try {
    const leaveType = await LeaveType.findByIdAndDelete(req.params.id);
    if (!leaveType) return res.status(404).json({ message: 'Leave type not found' });
    res.json({ message: 'Leave type deleted successfully' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType };
