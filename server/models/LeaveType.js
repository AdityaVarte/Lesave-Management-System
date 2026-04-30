const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema({
  type_name:            { type: String, required: true, enum: ['Casual', 'Sick', 'Paid'], unique: true },
  max_days_per_request: { type: Number, default: 10 },
  color:                { type: String, default: '#E4B84D' },
}, { timestamps: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
