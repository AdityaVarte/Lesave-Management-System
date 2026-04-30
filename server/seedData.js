const mongoose = require('mongoose');
const Employee = require('./models/Employee');
const LeaveType = require('./models/LeaveType');
const LeaveRequest = require('./models/LeaveRequest');

const seedData = async () => {
  try {
    const empCount = await Employee.countDocuments();
    if (empCount > 0) {
      console.log('📦 Database already seeded. Skipping...');
      return;
    }

    console.log('🌱 Seeding database...');

    // ─── Seed Leave Types ───────────────────────────────────────────────
    const leaveTypes = await LeaveType.insertMany([
      { type_name: 'Casual', max_days_per_request: 10, color: '#E4B84D' },
      { type_name: 'Sick',   max_days_per_request: 15, color: '#E07070' },
      { type_name: 'Paid',   max_days_per_request: 20, color: '#70C090' },
    ]);
    console.log('✅ Leave types seeded');

    const [casual, sick, paid] = leaveTypes;

    // ─── Seed Employees (passwords hashed by pre-save hook) ─────────────
    const employees = [];
    const empData = [
      { name: 'Admin User',   email: 'admin@company.com',  department: 'HR',          role: 'admin',    total_leaves: 20, password: 'admin123' },
      { name: 'Rohan Sharma', email: 'rohan@company.com',  department: 'Engineering', role: 'employee', total_leaves: 20, password: 'pass123' },
      { name: 'Priya Mehta',  email: 'priya@company.com',  department: 'Design',      role: 'employee', total_leaves: 20, password: 'pass123' },
      { name: 'Arjun Patel',  email: 'arjun@company.com',  department: 'Finance',     role: 'employee', total_leaves: 20, password: 'pass123' },
      { name: 'Sneha Verma',  email: 'sneha@company.com',  department: 'Marketing',   role: 'employee', total_leaves: 20, password: 'pass123' },
    ];

    for (const data of empData) {
      const emp = new Employee(data);
      await emp.save(); // triggers pre-save bcrypt hook
      employees.push(emp);
    }
    console.log('✅ Employees seeded');

    const [admin, rohan, priya, arjun, sneha] = employees;

    // ─── Seed Leave Requests ──────────────────────────────────────────────
    const leaveRequests = [
      // Approved leaves
      {
        employee_ref: rohan._id,
        employee_snapshot: { name: rohan.name, email: rohan.email, department: rohan.department },
        leave_type: { type_id: casual._id, type_name: 'Casual', color: casual.color },
        start_date: new Date('2025-01-06'),
        end_date:   new Date('2025-01-08'),
        reason: 'Personal errands and family commitments',
        status: 'Approved',
        applied_on: new Date('2025-01-02'),
      },
      {
        employee_ref: priya._id,
        employee_snapshot: { name: priya.name, email: priya.email, department: priya.department },
        leave_type: { type_id: sick._id, type_name: 'Sick', color: sick.color },
        start_date: new Date('2025-02-10'),
        end_date:   new Date('2025-02-12'),
        reason: 'Fever and doctor recommended rest for recovery',
        status: 'Approved',
        applied_on: new Date('2025-02-08'),
      },
      {
        employee_ref: arjun._id,
        employee_snapshot: { name: arjun.name, email: arjun.email, department: arjun.department },
        leave_type: { type_id: paid._id, type_name: 'Paid', color: paid.color },
        start_date: new Date('2025-03-17'),
        end_date:   new Date('2025-03-21'),
        reason: 'Annual vacation with family to visit hometown',
        status: 'Approved',
        applied_on: new Date('2025-03-10'),
      },
      {
        employee_ref: sneha._id,
        employee_snapshot: { name: sneha.name, email: sneha.email, department: sneha.department },
        leave_type: { type_id: casual._id, type_name: 'Casual', color: casual.color },
        start_date: new Date('2025-04-07'),
        end_date:   new Date('2025-04-09'),
        reason: 'Attending a family wedding ceremony out of town',
        status: 'Approved',
        applied_on: new Date('2025-04-01'),
      },
      // Pending leaves
      {
        employee_ref: rohan._id,
        employee_snapshot: { name: rohan.name, email: rohan.email, department: rohan.department },
        leave_type: { type_id: paid._id, type_name: 'Paid', color: paid.color },
        start_date: new Date('2025-05-19'),
        end_date:   new Date('2025-05-23'),
        reason: 'Planned vacation trip to Goa with friends',
        status: 'Pending',
        applied_on: new Date('2025-05-01'),
      },
      {
        employee_ref: priya._id,
        employee_snapshot: { name: priya.name, email: priya.email, department: priya.department },
        leave_type: { type_id: casual._id, type_name: 'Casual', color: casual.color },
        start_date: new Date('2025-05-26'),
        end_date:   new Date('2025-05-27'),
        reason: 'Personal work and appointment with doctor',
        status: 'Pending',
        applied_on: new Date('2025-05-15'),
      },
      {
        employee_ref: arjun._id,
        employee_snapshot: { name: arjun.name, email: arjun.email, department: arjun.department },
        leave_type: { type_id: sick._id, type_name: 'Sick', color: sick.color },
        start_date: new Date('2025-05-28'),
        end_date:   new Date('2025-05-29'),
        reason: 'Medical checkup and treatment follow up',
        status: 'Pending',
        applied_on: new Date('2025-05-20'),
      },
      // Rejected leaves
      {
        employee_ref: sneha._id,
        employee_snapshot: { name: sneha.name, email: sneha.email, department: sneha.department },
        leave_type: { type_id: paid._id, type_name: 'Paid', color: paid.color },
        start_date: new Date('2025-01-20'),
        end_date:   new Date('2025-01-24'),
        reason: 'Extended vacation for personal travel',
        status: 'Rejected',
        rejection_reason: 'Critical project deadline during this period',
        applied_on: new Date('2025-01-15'),
      },
      {
        employee_ref: rohan._id,
        employee_snapshot: { name: rohan.name, email: rohan.email, department: rohan.department },
        leave_type: { type_id: casual._id, type_name: 'Casual', color: casual.color },
        start_date: new Date('2025-02-24'),
        end_date:   new Date('2025-02-25'),
        reason: 'Personal commitments that could not be rescheduled',
        status: 'Rejected',
        rejection_reason: 'Team sprint review scheduled on same days',
        applied_on: new Date('2025-02-20'),
      },
      {
        employee_ref: priya._id,
        employee_snapshot: { name: priya.name, email: priya.email, department: priya.department },
        leave_type: { type_id: sick._id, type_name: 'Sick', color: sick.color },
        start_date: new Date('2025-04-14'),
        end_date:   new Date('2025-04-15'),
        reason: 'Feeling unwell and need rest for quick recovery',
        status: 'Rejected',
        rejection_reason: 'No medical certificate provided as required',
        applied_on: new Date('2025-04-10'),
      },
    ];

    // Use individual save() so the pre-save hook calculates working_days
    for (const req of leaveRequests) {
      const lr = new LeaveRequest(req);
      await lr.save();
    }

    console.log('✅ Leave requests seeded');
    console.log('🎉 Database seeding complete!');
    console.log('\n📋 Demo credentials:');
    console.log('   Admin:    admin@company.com / admin123');
    console.log('   Employee: rohan@company.com  / pass123');

  } catch (err) {
    console.error('❌ Seed error:', err.message);
  }
};

module.exports = seedData;
