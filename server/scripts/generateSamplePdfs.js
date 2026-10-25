const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Employee = require('../models/Employee');
const LeaveType = require('../models/LeaveType');
const LeaveRequest = require('../models/LeaveRequest');
const pdfService = require('../services/pdfService');

async function run() {
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const casual = await LeaveType.create({ type_name: 'Casual', max_days_per_request: 10, color: '#000000' });
  const sick = await LeaveType.create({ type_name: 'Sick', max_days_per_request: 15, color: '#000000' });
  const paid = await LeaveType.create({ type_name: 'Paid', max_days_per_request: 20, color: '#000000' });

  const admin = await Employee.create({
    name: 'Admin Director',
    email: 'admin.director@company.com',
    department: 'HR',
    role: 'admin',
    total_leaves: 30,
    password: 'password123',
  });

  const emp1 = await Employee.create({
    name: 'Rohan Sharma',
    email: 'rohan.eng@company.com',
    department: 'Engineering',
    role: 'employee',
    total_leaves: 20,
    password: 'password123',
  });

  const emp2 = await Employee.create({
    name: 'Priya Mehta',
    email: 'priya.des@company.com',
    department: 'Design',
    role: 'employee',
    total_leaves: 20,
    password: 'password123',
  });

  const emp3 = await Employee.create({
    name: 'Amit Patel',
    email: 'amit.ops@company.com',
    department: 'Operations',
    role: 'employee',
    total_leaves: 22,
    password: 'password123',
  });

  // Sample requests for leave_list (including one long reason)
  await LeaveRequest.create({
    employee_ref: emp1._id,
    employee_snapshot: { name: emp1.name, email: emp1.email, department: emp1.department },
    leave_type: { type_id: casual._id, type_name: 'Casual' },
    start_date: new Date('2026-10-15T00:00:00.000+05:30'),
    end_date: new Date('2026-10-16T23:59:59.999+05:30'),
    working_days: 2,
    status: 'Approved',
    reason: 'Attending sibling wedding ceremony in hometown with extended family members.',
    createdAt: new Date('2026-10-10T10:30:00.000+05:30'),
  });

  await LeaveRequest.create({
    employee_ref: emp2._id,
    employee_snapshot: { name: emp2.name, email: emp2.email, department: emp2.department },
    leave_type: { type_id: sick._id, type_name: 'Sick' },
    start_date: new Date('2026-10-19T00:00:00.000+05:30'),
    end_date: new Date('2026-10-21T23:59:59.999+05:30'),
    working_days: 3,
    status: 'Pending',
    reason: 'Severe viral fever and seasonal flu; medical consultation advised complete bed rest and clinical observation for the upcoming three days until body temperature normalizes and full recovery is achieved.',
    createdAt: new Date('2026-10-14T09:15:00.000+05:30'),
  });

  await LeaveRequest.create({
    employee_ref: emp3._id,
    employee_snapshot: { name: emp3.name, email: emp3.email, department: emp3.department },
    leave_type: { type_id: paid._id, type_name: 'Paid' },
    start_date: new Date('2026-10-26T00:00:00.000+05:30'),
    end_date: new Date('2026-10-30T23:59:59.999+05:30'),
    working_days: 5,
    status: 'Approved',
    reason: 'Annual Diwali festive vacation planned in advance.',
    createdAt: new Date('2026-10-01T14:20:00.000+05:30'),
  });

  await LeaveRequest.create({
    employee_ref: emp1._id,
    employee_snapshot: { name: emp1.name, email: emp1.email, department: emp1.department },
    leave_type: { type_id: casual._id, type_name: 'Casual' },
    start_date: new Date('2026-11-02T00:00:00.000+05:30'),
    end_date: new Date('2026-11-03T23:59:59.999+05:30'),
    working_days: 2,
    status: 'Rejected',
    reason: 'Personal urgent bank and property registry work in hometown.',
    rejection_reason: 'High project release workload during the first week of November.',
    createdAt: new Date('2026-10-12T16:45:00.000+05:30'),
  });

  // Ensure server/tmp directory exists
  const tmpDir = path.resolve(__dirname, '../tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  // 1. Generate sample-report.pdf (admin, leave_list, a few rows plus one long reason)
  console.log('Generating sample-report.pdf...');
  const res1 = await pdfService.generatePdf({
    reportType: 'leave_list',
    user: admin,
    filters: {},
  });
  const meta1 = pdfService.getFileMetadata(res1.file.id);
  const target1 = path.join(tmpDir, 'sample-report.pdf');
  fs.copyFileSync(meta1.filePath, target1);
  console.log('Saved sample-report.pdf to:', target1);

  // 2. Generate sample-department-summary.pdf
  console.log('Generating sample-department-summary.pdf...');
  const res2 = await pdfService.generatePdf({
    reportType: 'department_summary',
    user: admin,
    filters: {},
  });
  const meta2 = pdfService.getFileMetadata(res2.file.id);
  const target2 = path.join(tmpDir, 'sample-department-summary.pdf');
  fs.copyFileSync(meta2.filePath, target2);
  console.log('Saved sample-department-summary.pdf to:', target2);

  await mongoose.disconnect();
  await mongod.stop();
  console.log('Done generating sample PDFs.');
}

run().catch((err) => {
  console.error('Error generating sample PDFs:', err);
  process.exit(1);
});
