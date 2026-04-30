import { formatDate } from './dateFormat';

export const exportToCSV = (data, filename = 'leaves_export') => {
  if (!data || data.length === 0) return;

  const headers = [
    'Employee', 'Department', 'Leave Type', 'Start Date', 'End Date',
    'Working Days', 'Status', 'Reason', 'Rejection Reason', 'Applied On',
  ];

  const rows = data.map((leave) => [
    leave.employee_snapshot?.name || '',
    leave.employee_snapshot?.department || '',
    leave.leave_type?.type_name || '',
    formatDate(leave.start_date),
    formatDate(leave.end_date),
    leave.working_days || '',
    leave.status || '',
    `"${(leave.reason || '').replace(/"/g, '""')}"`,
    `"${(leave.rejection_reason || '').replace(/"/g, '""')}"`,
    formatDate(leave.applied_on),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
