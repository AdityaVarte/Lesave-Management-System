const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const dataService = require('./dataService');
const { formatDisplayDate, formatISODate, getCalcuttaTodayString } = require('../utils/dateUtils');

const REPORTS_DIR = path.resolve(__dirname, '../tmp/reports');
const PDF_LIMIT_PER_HOUR = parseInt(process.env.PDF_LIMIT_PER_HOUR, 10) || 20;

// Strict monochrome palette — only black, white, and grays for clean office printouts
const PDF_COLORS = {
  BLACK: '#000000',
  WHITE: '#FFFFFF',
  DARK_GRAY: '#333333',
  MID_GRAY: '#666666',
  LIGHT_GRAY: '#CCCCCC',
  BG_HEADER: '#E5E5E5',
  BG_ALT_ROW: '#F7F7F7',
};

// In-memory file registry: id -> metadata (30 minute TTL)
const fileRegistry = new Map();

// Rate limiter tracking: userId -> [timestamp, ...]
const userRateLimits = new Map();

/**
 * Format date and time for Asia/Calcutta in 12-hour format with AM/PM (e.g. "14 Oct 2026, 11:48 AM").
 */
const formatCalcuttaDateTime = (date = new Date()) => {
  const dt = new Date(date);
  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dt);
  return formatted.replace(/am|pm/i, (m) => m.toUpperCase());
};

/**
 * Clean and sanitize untrusted text before writing to PDF.
 */
const sanitizeText = (str) => {
  if (typeof str !== 'string') return '';
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ').trim();
};

/**
 * Enforce sliding-window rate limit per user per hour.
 */
const checkRateLimit = (userId) => {
  const uid = String(userId);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;

  let timestamps = userRateLimits.get(uid) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= PDF_LIMIT_PER_HOUR) {
    const err = new Error(`Hourly PDF generation limit reached (max ${PDF_LIMIT_PER_HOUR} per hour). Please try again later.`);
    err.status = 429;
    throw err;
  }

  timestamps.push(now);
  userRateLimits.set(uid, timestamps);
};

/**
 * Startup sweep to clean up old generated PDF files.
 */
const startupSweep = () => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
      return;
    }
    const files = fs.readdirSync(REPORTS_DIR);
    const now = Date.now();
    for (const file of files) {
      if (file.endsWith('.pdf')) {
        const fullPath = path.join(REPORTS_DIR, file);
        const stat = fs.statSync(fullPath);
        if (now - stat.mtimeMs > 30 * 60 * 1000) {
          fs.unlinkSync(fullPath);
        }
      }
    }
  } catch (_) {}
};

// Run startup sweep immediately
startupSweep();

// Periodic cleanup interval (runs every 5 minutes)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [id, meta] of fileRegistry.entries()) {
    if (now >= meta.expiresAt) {
      try {
        if (fs.existsSync(meta.filePath)) {
          fs.unlinkSync(meta.filePath);
        }
      } catch (_) {}
      fileRegistry.delete(id);
    }
  }
}, 5 * 60 * 1000);

// Prevent cleanup interval from holding the Node process open in test runners
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Generate a formal office monochrome PDF report.
 */
const generatePdf = async ({ reportType, filters = {}, user }) => {
  if (!user || !user._id) {
    throw new dataService.PermissionDeniedError('Authentication required to generate PDF reports');
  }

  const validTypes = ['my_leaves', 'leave_list', 'pending_requests', 'department_summary', 'employee_report'];
  if (!validTypes.includes(reportType)) {
    throw new Error(`Invalid report type: '${reportType}'. Allowed: ${validTypes.join(', ')}`);
  }

  // Non-admins can only generate 'my_leaves'
  if (user.role !== 'admin' && reportType !== 'my_leaves') {
    throw new dataService.PermissionDeniedError('Access denied: Admin permission required to generate company-wide reports');
  }

  // Check rate limit
  checkRateLimit(user._id);

  // Whitelist filters
  const cleanFilters = {
    department: filters.department,
    status: filters.status,
    leave_type: filters.leave_type,
    from: filters.from,
    to: filters.to,
    limit: Math.min(Number(filters.limit) || 200, 200),
  };
  if (user.role === 'admin' && filters.employee_email) {
    cleanFilters.employee_email = filters.employee_email;
  }

  // Fetch report data
  let rows = [];
  let totalCount = 0;
  let isTruncated = false;

  if (reportType === 'my_leaves') {
    const res = await dataService.getMyLeaves(user, cleanFilters);
    rows = res.rows || [];
    totalCount = res.total || rows.length;
    isTruncated = res.truncated;
  } else if (reportType === 'leave_list') {
    const res = await dataService.searchLeaves(user, cleanFilters);
    rows = res.rows || [];
    totalCount = res.total || rows.length;
    isTruncated = res.truncated;
  } else if (reportType === 'pending_requests') {
    const res = await dataService.getPendingLeaves(user, cleanFilters);
    rows = res.rows || [];
    totalCount = res.total || rows.length;
    isTruncated = res.truncated;
  } else if (reportType === 'employee_report') {
    const res = await dataService.searchLeaves(user, cleanFilters);
    rows = res.rows || [];
    totalCount = res.total || rows.length;
    isTruncated = res.truncated;
  } else if (reportType === 'department_summary') {
    const summary = await dataService.getDepartmentSummary(user, cleanFilters);
    rows = summary || [];
    totalCount = rows.length;
    isTruncated = false;
  }

  // Zero rows: no PDF created
  if (rows.length === 0) {
    return {
      file: null,
      rowCount: 0,
      totalCount: 0,
      truncated: false,
      message: 'No matching leave records found for this report.',
    };
  }

  // Cap at 200 rows
  if (rows.length > 200) {
    isTruncated = true;
    rows = rows.slice(0, 200);
  }

  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  const todayStr = getCalcuttaTodayString();
  const dateCompact = todayStr.replace(/-/g, '');
  const randomHex4 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const reportRef = `LF-${dateCompact}-${randomHex4}`;
  const fileId = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  const outPath = path.join(REPORTS_DIR, `${fileId}.pdf`);

  // Determine display filename
  const titleTypeMap = {
    my_leaves: { title: 'LEAVE REPORT', fileSuffix: 'My-Leaves' },
    leave_list: { title: 'LEAVE REPORT', fileSuffix: 'Leave-Report' },
    pending_requests: { title: 'PENDING LEAVE REQUESTS', fileSuffix: 'Pending-Requests' },
    department_summary: { title: 'DEPARTMENT LEAVE SUMMARY', fileSuffix: 'Department-Summary' },
    employee_report: { title: 'EMPLOYEE LEAVE REPORT', fileSuffix: 'Employee-Report' },
  };
  const { title: reportTitle, fileSuffix } = titleTypeMap[reportType];
  const displayName = `LeaveFlow-${fileSuffix}-${todayStr}.pdf`;

  // Build the PDF using PDFKit in landscape A4
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margin: 36,
    bufferPages: true,
    compress: false,
    info: {
      Title: reportTitle,
      Author: 'LeaveFlow',
      Subject: 'Leave Management Report',
    },
  });

  const writeStream = fs.createWriteStream(outPath);
  doc.pipe(writeStream);

  const pageWidth = 841.89;
  const leftX = 36;
  const contentWidth = 770;
  const rightX = leftX + contentWidth; // 806
  const bottomLimit = 525;
  const nowFormatted = formatCalcuttaDateTime();

  // ─── 1. Header Line: "LeaveFlow" and "Report Ref" ───
  let currentY = 36;
  doc.font('Helvetica-Bold').fontSize(20).fillColor(PDF_COLORS.BLACK)
    .text('LeaveFlow', leftX, currentY, { lineBreak: false });

  doc.font('Helvetica').fontSize(10).fillColor(PDF_COLORS.DARK_GRAY)
    .text(`Report Ref: ${reportRef}`, leftX, currentY + 8, { align: 'right', width: contentWidth });

  currentY += 26;

  // Thin black rule under title
  doc.strokeColor(PDF_COLORS.BLACK).lineWidth(0.5)
    .moveTo(leftX, currentY).lineTo(rightX, currentY).stroke();

  currentY += 10;

  // ─── 2. Report Title Centered, Bold, Uppercase ───
  doc.font('Helvetica-Bold').fontSize(14).fillColor(PDF_COLORS.BLACK)
    .text(reportTitle, leftX, currentY, { align: 'center', width: contentWidth });

  currentY += 22;

  // ─── 3. Details Block in Two Columns ───
  const colLeftX = leftX;
  const colRightX = leftX + 400;
  const colWidth = 360;
  const detailLineHeight = 13;

  const periodText = cleanFilters.from && cleanFilters.to
    ? `${formatDisplayDate(cleanFilters.from)} to ${formatDisplayDate(cleanFilters.to)}`
    : (cleanFilters.from ? `From ${formatDisplayDate(cleanFilters.from)}` : (cleanFilters.to ? `Up to ${formatDisplayDate(cleanFilters.to)}` : 'All dates'));

  const deptText = cleanFilters.department || 'All';
  const statusText = cleanFilters.status || 'All';
  const typeText = cleanFilters.leave_type || 'All';
  const empText = cleanFilters.employee_email || (reportType === 'employee_report' && rows[0]?.employee_snapshot?.name ? `${rows[0].employee_snapshot.name} (${rows[0].employee_snapshot.department || 'All'})` : null);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_COLORS.BLACK);

  // Left column
  doc.text('Generated On: ', colLeftX, currentY, { continued: true })
    .font('Helvetica').text(nowFormatted);
  doc.font('Helvetica-Bold').text('Generated By: ', colLeftX, currentY + detailLineHeight, { continued: true })
    .font('Helvetica').text(`${user.name} (${user.role === 'admin' ? 'Administrator' : 'Employee'})`);
  doc.font('Helvetica-Bold').text('Report Period: ', colLeftX, currentY + detailLineHeight * 2, { continued: true })
    .font('Helvetica').text(periodText);
  doc.font('Helvetica-Bold').text('Department: ', colLeftX, currentY + detailLineHeight * 3, { continued: true })
    .font('Helvetica').text(deptText);

  // Right column
  doc.font('Helvetica-Bold').text('Status Filter: ', colRightX, currentY, { continued: true })
    .font('Helvetica').text(statusText);
  doc.font('Helvetica-Bold').text('Leave Type: ', colRightX, currentY + detailLineHeight, { continued: true })
    .font('Helvetica').text(typeText);
  if (empText) {
    doc.font('Helvetica-Bold').text('Employee: ', colRightX, currentY + detailLineHeight * 2, { continued: true })
      .font('Helvetica').text(empText);
  }
  doc.font('Helvetica-Bold').text('Total Records: ', colRightX, currentY + (empText ? detailLineHeight * 3 : detailLineHeight * 2), { continued: true })
    .font('Helvetica').text(isTruncated ? `${rows.length} of ${totalCount} (Showing first 200)` : `${rows.length}`);

  currentY += (empText ? detailLineHeight * 4 : detailLineHeight * 3) + 12;

  // ─── 4. Summary Heading & Bordered Summary Table ───
  doc.font('Helvetica-Bold').fontSize(11).fillColor(PDF_COLORS.BLACK)
    .text('Summary', leftX, currentY);
  currentY += 15;

  if (reportType === 'department_summary') {
    // Dept summary small table
    const sCols = [
      { title: 'Department', width: 270, align: 'left' },
      { title: 'Requests', width: 250, align: 'center' },
      { title: 'Working Days', width: 250, align: 'center' },
    ];
    const sRowHeight = 16;

    // Header
    doc.rect(leftX, currentY, contentWidth, sRowHeight).fillAndStroke(PDF_COLORS.BG_HEADER, PDF_COLORS.LIGHT_GRAY);
    let sx = leftX;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.BLACK);
    for (const c of sCols) {
      doc.text(c.title, sx + 4, currentY + 4, { width: c.width - 8, align: c.align });
      sx += c.width;
    }
    currentY += sRowHeight;

    // Row per department
    doc.font('Helvetica').fontSize(8.5);
    for (const r of rows) {
      doc.rect(leftX, currentY, contentWidth, sRowHeight).fillAndStroke(PDF_COLORS.WHITE, PDF_COLORS.LIGHT_GRAY);
      sx = leftX;
      doc.fillColor(PDF_COLORS.BLACK);
      doc.text(sanitizeText(r.department), sx + 4, currentY + 4, { width: sCols[0].width - 8, align: sCols[0].align });
      sx += sCols[0].width;
      doc.text(String(r.count || 0), sx + 4, currentY + 4, { width: sCols[1].width - 8, align: sCols[1].align });
      sx += sCols[1].width;
      doc.text(String(r.totalDays || 0), sx + 4, currentY + 4, { width: sCols[2].width - 8, align: sCols[2].align });
      currentY += sRowHeight;
    }
  } else {
    // Leave list summary counts
    const approvedCount = rows.filter((r) => r.status === 'Approved').length;
    const pendingCount = rows.filter((r) => r.status === 'Pending').length;
    const rejectedCount = rows.filter((r) => r.status === 'Rejected').length;
    const totalWorkingDays = rows.reduce((sum, r) => sum + (Number(r.working_days) || 0), 0);

    const sCols = [
      { title: 'Total Requests', width: 154, align: 'center', value: String(rows.length) },
      { title: 'Total Working Days', width: 154, align: 'center', value: String(totalWorkingDays) },
      { title: 'Approved', width: 154, align: 'center', value: String(approvedCount) },
      { title: 'Pending', width: 154, align: 'center', value: String(pendingCount) },
      { title: 'Rejected', width: 154, align: 'center', value: String(rejectedCount) },
    ];
    const sRowHeight = 16;

    // Header
    doc.rect(leftX, currentY, contentWidth, sRowHeight).fillAndStroke(PDF_COLORS.BG_HEADER, PDF_COLORS.LIGHT_GRAY);
    let sx = leftX;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.BLACK);
    for (const c of sCols) {
      doc.text(c.title, sx, currentY + 4, { width: c.width, align: c.align });
      sx += c.width;
    }
    currentY += sRowHeight;

    // Value row
    doc.rect(leftX, currentY, contentWidth, sRowHeight).fillAndStroke(PDF_COLORS.WHITE, PDF_COLORS.LIGHT_GRAY);
    sx = leftX;
    doc.font('Helvetica').fontSize(8.5).fillColor(PDF_COLORS.BLACK);
    for (const c of sCols) {
      doc.text(c.value, sx, currentY + 4, { width: c.width, align: c.align });
      sx += c.width;
    }
    currentY += sRowHeight;
  }

  currentY += 15;

  // ─── 5. Details Heading & Main Table ───
  doc.font('Helvetica-Bold').fontSize(11).fillColor(PDF_COLORS.BLACK)
    .text('Details', leftX, currentY);
  currentY += 15;

  // Define main table columns
  let columns = [];
  const isEmployeeOwnReport = reportType === 'my_leaves';

  if (reportType === 'department_summary') {
    columns = [
      { key: 'sno', label: 'S.No', width: 60, align: 'center' },
      { key: 'department', label: 'Department', width: 250, align: 'left' },
      { key: 'requests', label: 'Total Requests', width: 230, align: 'center' },
      { key: 'days', label: 'Total Working Days', width: 230, align: 'center' },
    ];
  } else if (isEmployeeOwnReport) {
    // Hide Employee and Department columns for employee's own report
    columns = [
      { key: 'sno', label: 'S.No', width: 40, align: 'center' },
      { key: 'leave_type', label: 'Leave Type', width: 90, align: 'left' },
      { key: 'from', label: 'From', width: 80, align: 'center' },
      { key: 'to', label: 'To', width: 80, align: 'center' },
      { key: 'days', label: 'Days', width: 45, align: 'center' },
      { key: 'status', label: 'Status', width: 75, align: 'center' },
      { key: 'reason', label: 'Reason', width: 280, align: 'left' },
      { key: 'applied_on', label: 'Applied On', width: 80, align: 'center' },
    ];
  } else {
    // Admin full columns
    columns = [
      { key: 'sno', label: 'S.No', width: 35, align: 'center' },
      { key: 'employee', label: 'Employee', width: 95, align: 'left' },
      { key: 'department', label: 'Department', width: 75, align: 'left' },
      { key: 'leave_type', label: 'Leave Type', width: 65, align: 'left' },
      { key: 'from', label: 'From', width: 65, align: 'center' },
      { key: 'to', label: 'To', width: 65, align: 'center' },
      { key: 'days', label: 'Days', width: 35, align: 'center' },
      { key: 'status', label: 'Status', width: 60, align: 'center' },
      { key: 'reason', label: 'Reason', width: 110, align: 'left' },
      { key: 'applied_on', label: 'Applied On', width: 65, align: 'center' },
    ];
  }

  const headerHeight = 20;

  // Helper to draw repeated table header
  const drawTableHeader = (y) => {
    doc.rect(leftX, y, contentWidth, headerHeight).fillAndStroke(PDF_COLORS.BG_HEADER, PDF_COLORS.BLACK);
    let hx = leftX;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(PDF_COLORS.BLACK);
    for (const col of columns) {
      doc.text(col.label, hx + 2, y + 5, { width: col.width - 4, align: 'center' });
      // Draw vertical separator
      doc.strokeColor(PDF_COLORS.BLACK).lineWidth(0.5)
        .moveTo(hx, y).lineTo(hx, y + headerHeight).stroke();
      hx += col.width;
    }
    // Rightmost border
    doc.strokeColor(PDF_COLORS.BLACK).lineWidth(0.5)
      .moveTo(rightX, y).lineTo(rightX, y + headerHeight).stroke();
  };

  // Draw initial table header
  drawTableHeader(currentY);
  currentY += headerHeight;

  // Draw body rows
  let sno = 1;
  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const item = rows[rIdx];

    // Prepare cell values
    let rowData = {};
    if (reportType === 'department_summary') {
      rowData = {
        sno: String(sno),
        department: sanitizeText(item.department),
        requests: String(item.count || 0),
        days: String(item.totalDays || 0),
      };
    } else {
      const empName = sanitizeText(item.employee_snapshot?.name || item.employee_name || 'Employee');
      const dept = sanitizeText(item.employee_snapshot?.department || item.department || '');
      const typeName = sanitizeText(item.leave_type?.type_name || item.leave_type || 'Leave');
      const fromD = formatDisplayDate(item.start_date);
      const toD = formatDisplayDate(item.end_date);
      const days = String(item.working_days || 0);
      const status = sanitizeText(item.status || 'Pending');
      const rawReason = sanitizeText(item.reason || '');
      const appliedOn = formatDisplayDate(item.applied_on || item.createdAt);

      rowData = {
        sno: String(sno),
        employee: empName,
        department: dept,
        leave_type: typeName,
        from: fromD,
        to: toD,
        days: days,
        status: status,
        reason: rawReason,
        applied_on: appliedOn,
      };
    }

    // Determine row height based on reason text (limit to max 3 lines ~32pt)
    let dynamicRowHeight = 18;
    if (rowData.reason) {
      const reasonCol = columns.find((c) => c.key === 'reason');
      const rWidth = (reasonCol ? reasonCol.width : 110) - 8;
      doc.font('Helvetica').fontSize(8.5);
      const measured = doc.heightOfString(rowData.reason, { width: rWidth });
      // Cap at 3 lines (max ~32pt) + 6pt padding
      dynamicRowHeight = Math.max(18, Math.min(36, measured + 6));
    }

    // Page break check: if row overflows bottomLimit, add page and repeat header
    if (currentY + dynamicRowHeight > bottomLimit) {
      doc.addPage();
      currentY = 40;
      drawTableHeader(currentY);
      currentY += headerHeight;
    }

    // Row background fill (alternate rows light gray)
    const rowBg = rIdx % 2 === 1 ? PDF_COLORS.BG_ALT_ROW : PDF_COLORS.WHITE;
    doc.rect(leftX, currentY, contentWidth, dynamicRowHeight).fillAndStroke(rowBg, PDF_COLORS.LIGHT_GRAY);

    // Draw cell texts and vertical separators
    let cx = leftX;
    doc.font('Helvetica').fontSize(8.5).fillColor(PDF_COLORS.BLACK);

    for (const col of columns) {
      const val = rowData[col.key] || '';
      const pad = 4;
      const textWidth = col.width - pad * 2;

      if (col.key === 'reason') {
        // Reason column: max 3 lines, wraps, adds ellipsis if overflows
        doc.text(val, cx + pad, currentY + 3, {
          width: textWidth,
          height: dynamicRowHeight - 4,
          ellipsis: true,
        });
      } else if (col.key === 'status') {
        // Plain text status (no color)
        doc.font('Helvetica-Bold')
          .text(val, cx + pad, currentY + 4, { width: textWidth, align: col.align })
          .font('Helvetica');
      } else {
        doc.text(val, cx + pad, currentY + 4, {
          width: textWidth,
          align: col.align,
          ellipsis: true,
        });
      }

      // Vertical line
      doc.strokeColor(PDF_COLORS.LIGHT_GRAY).lineWidth(0.5)
        .moveTo(cx, currentY).lineTo(cx, currentY + dynamicRowHeight).stroke();

      cx += col.width;
    }

    // Rightmost border
    doc.strokeColor(PDF_COLORS.LIGHT_GRAY).lineWidth(0.5)
      .moveTo(rightX, currentY).lineTo(rightX, currentY + dynamicRowHeight).stroke();

    currentY += dynamicRowHeight;
    sno += 1;
  }

  // ─── 6. End of Report Block ───
  currentY += 12;
  if (currentY + 25 > bottomLimit) {
    doc.addPage();
    currentY = 40;
  }

  if (isTruncated) {
    doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(PDF_COLORS.DARK_GRAY)
      .text(`Showing first 200 of ${totalCount} records. Narrow the filters to see the rest.`, leftX, currentY, {
        align: 'center',
        width: contentWidth,
      });
    currentY += 14;
  }

  doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_COLORS.BLACK)
    .text('*** End of Report ***', leftX, currentY, { align: 'center', width: contentWidth });

  // ─── 7. Footers on Every Page ───
  const pageRange = doc.bufferedPageRange();
  const totalPages = pageRange.count;

  for (let i = pageRange.start; i < pageRange.start + totalPages; i++) {
    doc.switchToPage(i);

    // Thin gray rule at y = 560
    doc.strokeColor(PDF_COLORS.LIGHT_GRAY).lineWidth(0.5)
      .moveTo(leftX, 560).lineTo(rightX, 560).stroke();

    // Footer text
    doc.font('Helvetica').fontSize(8).fillColor(PDF_COLORS.MID_GRAY);
    doc.text('LeaveFlow - Confidential - For internal use only', leftX, 568, { align: 'left', width: 280 });
    doc.text(`Generated on ${nowFormatted}`, leftX + 270, 568, { align: 'center', width: 230 });
    doc.text(`Page ${i + 1} of ${totalPages}`, rightX - 200, 568, { align: 'right', width: 200 });
  }

  doc.end();

  // Wait for file write stream to finish
  await new Promise((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  const metadata = {
    id: fileId,
    ownerId: String(user._id),
    displayName,
    filePath: outPath,
    reportType,
    reportRef,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 60 * 1000,
    rows: rows.length,
    totalCount,
    truncated: isTruncated,
  };

  fileRegistry.set(fileId, metadata);

  return {
    file: {
      id: fileId,
      name: displayName,
      url: `/api/chatbot/files/${fileId}`,
      expiresAt: new Date(metadata.expiresAt).toISOString(),
      rows: rows.length,
      totalCount,
      truncated: isTruncated,
      reportRef,
    },
    rowCount: rows.length,
    totalCount,
    truncated: isTruncated,
    message: isTruncated
      ? `Report generated with the first 200 of ${totalCount} records.`
      : `Report generated successfully with ${rows.length} record${rows.length === 1 ? '' : 's'}.`,
  };
};

/**
 * Get file metadata by 64-hex ID.
 */
const getFileMetadata = (id) => {
  if (!id || typeof id !== 'string') return null;
  return fileRegistry.get(id) || null;
};

/**
 * Delete file and metadata.
 */
const deleteFile = (id) => {
  if (!id) return;
  const meta = fileRegistry.get(id);
  if (meta) {
    try {
      if (fs.existsSync(meta.filePath)) {
        fs.unlinkSync(meta.filePath);
      }
    } catch (_) {}
    fileRegistry.delete(id);
  }
};

/**
 * Register file directly into registry (useful for mock/test assertions).
 */
const registerFileMetadata = (id, metadata) => {
  fileRegistry.set(id, metadata);
};

/**
 * Reset rate limits (for testing).
 */
const _resetRateLimits = () => {
  userRateLimits.clear();
};

module.exports = {
  generatePdf,
  getFileMetadata,
  deleteFile,
  registerFileMetadata,
  startupSweep,
  _resetRateLimits,
  PDF_COLORS,
  REPORTS_DIR,
};
