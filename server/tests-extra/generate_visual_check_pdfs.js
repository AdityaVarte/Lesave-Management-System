const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const Employee = require('../models/Employee');
const LeaveType = require('../models/LeaveType');
const LeaveRequest = require('../models/LeaveRequest');
const pdfService = require('../services/pdfService');

async function generateVisualPdfs() {
  console.log('Generating Visual Check PDFs...\n');

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

  const empRohan = await Employee.create({
    name: 'Rohan Sharma',
    email: 'rohan.eng@company.com',
    department: 'Engineering',
    role: 'employee',
    total_leaves: 20,
    password: 'password123',
  });

  const empPriya = await Employee.create({
    name: 'Priya Mehta',
    email: 'priya.des@company.com',
    department: 'Design',
    role: 'employee',
    total_leaves: 20,
    password: 'password123',
  });

  const empArjun = await Employee.create({
    name: 'Arjun Patel',
    email: 'arjun.fin@company.com',
    department: 'Finance',
    role: 'employee',
    total_leaves: 22,
    password: 'password123',
  });

  // 1. Seed requests for Rohan (my_leaves)
  await LeaveRequest.create([
    {
      employee_ref: empRohan._id,
      employee_snapshot: { name: empRohan.name, email: empRohan.email, department: empRohan.department },
      leave_type: { type_id: casual._id, type_name: 'Casual' },
      start_date: new Date('2026-10-05T00:00:00.000+05:30'),
      end_date: new Date('2026-10-07T00:00:00.000+05:30'),
      working_days: 3,
      reason: 'Attending cousin wedding and family ceremony in hometown',
      status: 'Approved',
      applied_on: new Date('2026-10-01'),
    },
    {
      employee_ref: empRohan._id,
      employee_snapshot: { name: empRohan.name, email: empRohan.email, department: empRohan.department },
      leave_type: { type_id: sick._id, type_name: 'Sick' },
      start_date: new Date('2026-10-12T00:00:00.000+05:30'),
      end_date: new Date('2026-10-13T00:00:00.000+05:30'),
      working_days: 2,
      reason: 'Severe viral fever and physician prescribed rest',
      status: 'Approved',
      applied_on: new Date('2026-10-11'),
    },
    {
      employee_ref: empRohan._id,
      employee_snapshot: { name: empRohan.name, email: empRohan.email, department: empRohan.department },
      leave_type: { type_id: paid._id, type_name: 'Paid' },
      start_date: new Date('2026-11-16T00:00:00.000+05:30'),
      end_date: new Date('2026-11-20T00:00:00.000+05:30'),
      working_days: 5,
      reason: 'Year-end planned family vacation to coastal resorts',
      status: 'Pending',
      applied_on: new Date('2026-10-15'),
    },
  ]);

  // 2. Generate PDF 1: my_leaves
  const myLeavesRes = await pdfService.generatePdf({
    reportType: 'my_leaves',
    user: empRohan,
  });
  console.log('✅ Generated my_leaves:', myLeavesRes.file.name, myLeavesRes.file.reportRef);

  // 3. Generate PDF 2: pending_requests
  await LeaveRequest.create([
    {
      employee_ref: empPriya._id,
      employee_snapshot: { name: empPriya.name, email: empPriya.email, department: empPriya.department },
      leave_type: { type_id: casual._id, type_name: 'Casual' },
      start_date: new Date('2026-11-02T00:00:00.000+05:30'),
      end_date: new Date('2026-11-03T00:00:00.000+05:30'),
      working_days: 2,
      reason: 'Urgent personal work and banking appointments',
      status: 'Pending',
      applied_on: new Date('2026-10-18'),
    },
    {
      employee_ref: empArjun._id,
      employee_snapshot: { name: empArjun.name, email: empArjun.email, department: empArjun.department },
      leave_type: { type_id: sick._id, type_name: 'Sick' },
      start_date: new Date('2026-11-04T00:00:00.000+05:30'),
      end_date: new Date('2026-11-05T00:00:00.000+05:30'),
      working_days: 2,
      reason: 'Eye surgery recovery and post-op checkup',
      status: 'Pending',
      applied_on: new Date('2026-10-19'),
    },
  ]);

  const pendingRes = await pdfService.generatePdf({
    reportType: 'pending_requests',
    user: admin,
  });
  console.log('✅ Generated pending_requests:', pendingRes.file.name, pendingRes.file.reportRef);

  // 4. Generate PDF 3: department_summary
  const deptSummaryRes = await pdfService.generatePdf({
    reportType: 'department_summary',
    user: admin,
  });
  console.log('✅ Generated department_summary:', deptSummaryRes.file.name, deptSummaryRes.file.reportRef);

  // 5. Generate PDF 4: employee_report (for Rohan)
  const empReportRes = await pdfService.generatePdf({
    reportType: 'employee_report',
    filters: { employee_email: empRohan.email },
    user: admin,
  });
  console.log('✅ Generated employee_report:', empReportRes.file.name, empReportRes.file.reportRef);

  // 6. Generate PDF 5: Multi-page leave_list (65 rows spanning across 3 pages)
  const batchLeaves = [];
  const deptList = ['Engineering', 'Design', 'Finance', 'HR', 'Marketing', 'Operations'];
  const typeList = ['Casual', 'Sick', 'Paid'];
  const statusList = ['Approved', 'Pending', 'Rejected'];

  for (let i = 1; i <= 65; i++) {
    const dept = deptList[i % deptList.length];
    const typeName = typeList[i % typeList.length];
    const status = statusList[i % statusList.length];
    batchLeaves.push({
      employee_ref: empRohan._id,
      employee_snapshot: {
        name: `Team Member ${String(i).padStart(2, '0')}`,
        email: `member${i}@company.com`,
        department: dept,
      },
      leave_type: { type_id: casual._id, type_name: typeName },
      start_date: new Date(2026, 8, (i % 25) + 1),
      end_date: new Date(2026, 8, (i % 25) + 2),
      working_days: (i % 4) + 1,
      reason: `Routine quarterly time off and personal recreation schedule #${i}`,
      status,
      applied_on: new Date(2026, 7, 20),
    });
  }
  await LeaveRequest.insertMany(batchLeaves);

  const multiPageRes = await pdfService.generatePdf({
    reportType: 'leave_list',
    user: admin,
  });
  console.log('✅ Generated multi-page leave_list (65+ rows):', multiPageRes.file.name, multiPageRes.file.reportRef);

  // 7. Generate PDF 6: Very Long Reason
  await LeaveRequest.create({
    employee_ref: empRohan._id,
    employee_snapshot: { name: empRohan.name, email: empRohan.email, department: empRohan.department },
    leave_type: { type_id: sick._id, type_name: 'Sick' },
    start_date: new Date('2026-11-25T00:00:00.000+05:30'),
    end_date: new Date('2026-11-27T00:00:00.000+05:30'),
    working_days: 3,
    reason: 'Undergoing specialized orthopedic consultation, diagnostic imaging including MRI and radiological screening, followed by mandatory physician-ordered absolute physical rest and rehabilitation therapy session as per medical board certificate.',
    status: 'Pending',
    applied_on: new Date('2026-10-20'),
  });

  const longReasonRes = await pdfService.generatePdf({
    reportType: 'my_leaves',
    user: empRohan,
  });
  console.log('✅ Generated long_reason report:', longReasonRes.file.name, longReasonRes.file.reportRef);

  // 8. Generate PDF 7: 200-row cap test (insert 210 records)
  const capBatch = [];
  for (let i = 1; i <= 210; i++) {
    capBatch.push({
      employee_ref: empPriya._id,
      employee_snapshot: { name: `Archive User ${i}`, email: `archive${i}@company.com`, department: 'Design' },
      leave_type: { type_id: casual._id, type_name: 'Casual' },
      start_date: new Date('2026-05-01'),
      end_date: new Date('2026-05-02'),
      working_days: 1,
      reason: `Archive annual historical leave record item number ${i}`,
      status: 'Approved',
      applied_on: new Date('2026-04-15'),
    });
  }
  await LeaveRequest.insertMany(capBatch);

  const cap200Res = await pdfService.generatePdf({
    reportType: 'leave_list',
    user: admin,
  });
  console.log('✅ Generated cap_200 report:', cap200Res.file.name, cap200Res.file.reportRef);
  console.log('   Truncated flag:', cap200Res.truncated, 'totalCount:', cap200Res.totalCount, 'rowCount:', cap200Res.rowCount);

  // Save paths and metadata to a summary JSON for report reference
  const summary = {
    my_leaves: { ...myLeavesRes.file, filePath: pdfService.getFileMetadata(myLeavesRes.file.id).filePath },
    pending_requests: { ...pendingRes.file, filePath: pdfService.getFileMetadata(pendingRes.file.id).filePath },
    department_summary: { ...deptSummaryRes.file, filePath: pdfService.getFileMetadata(deptSummaryRes.file.id).filePath },
    employee_report: { ...empReportRes.file, filePath: pdfService.getFileMetadata(empReportRes.file.id).filePath },
    multi_page_leave_list: { ...multiPageRes.file, filePath: pdfService.getFileMetadata(multiPageRes.file.id).filePath },
    long_reason: { ...longReasonRes.file, filePath: pdfService.getFileMetadata(longReasonRes.file.id).filePath },
    cap_200: { ...cap200Res.file, filePath: pdfService.getFileMetadata(cap200Res.file.id).filePath },
  };

  fs.writeFileSync(
    path.resolve(__dirname, '../tmp/visual_pdf_manifest.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log('\nManifest saved to server/tmp/visual_pdf_manifest.json');

  await mongoose.disconnect();
  await mongod.stop();
  console.log('Done generating visual check PDFs.');
}

generateVisualPdfs().catch(console.error);
