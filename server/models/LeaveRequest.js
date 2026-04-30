const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({

  // REFERENCE — for updates and relationship integrity
  employee_ref: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },

  // EMBEDDED SNAPSHOT — denormalization for fast reads (no populate needed in reports)
  // Core NoSQL concept: store a snapshot so reports don't need JOINs
  employee_snapshot: {
    name:       { type: String, required: true },
    email:      { type: String, required: true },
    department: { type: String, required: true },
  },

  // EMBEDDED leave type — small document, rarely changes
  leave_type: {
    type_id:   { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    type_name: { type: String, required: true },
    color:     { type: String },
  },

  start_date:       { type: Date, required: true },
  end_date:         { type: Date, required: true },
  working_days:     { type: Number, min: 0.5 },
  is_half_day:      { type: Boolean, default: false },
  reason:           { type: String, required: true, minlength: [10, 'Reason must be at least 10 characters'] },
  status:           { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  rejection_reason: { type: String, default: null },
  applied_on:       { type: Date, default: Date.now },

}, { timestamps: true });

// PRE-SAVE MIDDLEWARE HOOK — auto-calculate working days excluding weekends
// This replaces a PL/SQL trigger in relational databases
leaveRequestSchema.pre('save', function (next) {
  if (this.isModified('start_date') || this.isModified('end_date') || this.isNew) {
    let count = 0;
    const current = new Date(this.start_date);
    const end = new Date(this.end_date);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    this.working_days = this.is_half_day ? Math.max(count * 0.5, 0.5) : count;
  }
  next();
});

// COMPOUND INDEXES — for query performance
leaveRequestSchema.index({ employee_ref: 1, status: 1 });
leaveRequestSchema.index({ start_date: 1, end_date: 1 });
leaveRequestSchema.index({ 'employee_snapshot.department': 1, status: 1 });
leaveRequestSchema.index({ status: 1, applied_on: -1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
