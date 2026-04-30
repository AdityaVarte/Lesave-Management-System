const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  name:         { type: String, required: [true, 'Name required'], trim: true, minlength: 2 },
  email:        { type: String, required: [true, 'Email required'], unique: true, lowercase: true, trim: true },
  department:   {
    type: String,
    required: true,
    enum: ['Engineering', 'Design', 'Finance', 'HR', 'Marketing', 'Operations']
  },
  role:         { type: String, enum: ['employee', 'admin'], default: 'employee' },
  total_leaves: { type: Number, default: 20, min: 1, max: 60 },
  password:     { type: String, required: true, minlength: 6 },
}, { timestamps: true });

// Mongoose pre-save middleware hook — hash password before save
// This replaces a PL/SQL trigger in relational databases
employeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

employeeSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Compound index for fast queries
employeeSchema.index({ department: 1, role: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
