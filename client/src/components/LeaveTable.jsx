import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { formatDate } from '../utils/dateFormat';

function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <div className="skeleton" style={{ height: '14px', borderRadius: '6px', width: i === 0 ? '140px' : '80px' }} />
        </td>
      ))}
    </tr>
  );
}

export default function LeaveTable({
  leaves = [],
  loading = false,
  onApprove,
  onReject,
  onCancel,
  showEmployee = true,
  expandRejection = false,
  actions,
}) {
  const [sortKey, setSortKey] = useState('applied_on');
  const [sortDir, setSortDir] = useState('desc');
  const [expanded, setExpanded] = useState({});

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...leaves].sort((a, b) => {
    let va = a[sortKey], vb = b[sortKey];
    if (sortKey === 'applied_on' || sortKey === 'start_date') {
      va = new Date(va); vb = new Date(vb);
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ChevronUp size={12} color="#5A5248" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} color="#C9A84C" />
      : <ChevronDown size={12} color="#C9A84C" />;
  };

  const headerStyle = {
    cursor: 'pointer', userSelect: 'none',
    display: 'flex', alignItems: 'center', gap: '4px',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            {showEmployee && (
              <th><div style={headerStyle} onClick={() => toggleSort('employee_snapshot.name')}>
                Employee <SortIcon col="employee_snapshot.name" />
              </div></th>
            )}
            <th><div style={headerStyle} onClick={() => toggleSort('leave_type.type_name')}>
              Type <SortIcon col="leave_type.type_name" />
            </div></th>
            <th><div style={headerStyle} onClick={() => toggleSort('start_date')}>
              Dates <SortIcon col="start_date" />
            </div></th>
            <th>Days</th>
            <th><div style={headerStyle} onClick={() => toggleSort('status')}>
              Status <SortIcon col="status" />
            </div></th>
            <th><div style={headerStyle} onClick={() => toggleSort('applied_on')}>
              Applied <SortIcon col="applied_on" />
            </div></th>
            {actions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} cols={showEmployee ? 7 : 6} />
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td colSpan={showEmployee ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: '#5A5248' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '32px' }}>📋</span>
                  <span>No leave records found</span>
                </div>
              </td>
            </tr>
          ) : (
            sorted.map((leave) => (
              <React.Fragment key={leave._id}>
                <tr
                  style={{ cursor: expandRejection && leave.status === 'Rejected' ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (expandRejection && leave.status === 'Rejected') {
                      setExpanded(prev => ({ ...prev, [leave._id]: !prev[leave._id] }));
                    }
                  }}>
                  {showEmployee && (
                    <td>
                      <div style={{ fontWeight: 500 }}>{leave.employee_snapshot?.name}</div>
                      <div style={{ fontSize: '12px', color: '#9a9080' }}>{leave.employee_snapshot?.department}</div>
                    </td>
                  )}
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '3px 9px', borderRadius: '6px',
                      fontSize: '12px', fontWeight: 500,
                      background: `${leave.leave_type?.color}18`,
                      color: leave.leave_type?.color || '#c9a84c',
                      border: `1px solid ${leave.leave_type?.color}30`,
                    }}>
                      {leave.leave_type?.type_name}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '13px' }}>{formatDate(leave.start_date)}</div>
                    <div style={{ fontSize: '12px', color: '#9a9080' }}>→ {formatDate(leave.end_date)}</div>
                    {leave.is_half_day && (
                      <span style={{ fontSize: '10px', color: '#c9a84c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Half Day</span>
                    )}
                  </td>
                  <td style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, color: '#c9a84c', fontSize: '18px' }}>
                    {leave.working_days}
                  </td>
                  <td><StatusBadge status={leave.status} /></td>
                  <td style={{ fontSize: '13px', color: '#9a9080' }}>{formatDate(leave.applied_on)}</td>
                  {actions && (
                    <td onClick={(e) => e.stopPropagation()}>
                      {actions(leave)}
                    </td>
                  )}
                </tr>
                {expandRejection && leave.status === 'Rejected' && expanded[leave._id] && (
                  <tr key={`${leave._id}-expanded`}>
                    <td colSpan={showEmployee ? 7 : 6} style={{ padding: '0 18px 14px', background: 'rgba(228,184,77,0.02)' }}>
                      <div style={{
                        padding: '10px 14px', borderRadius: '8px',
                        background: 'rgba(228,184,77,0.06)',
                        border: '1px solid rgba(228,184,77,0.15)',
                        fontSize: '13px', color: '#e4b84d',
                      }}>
                        <span style={{ color: '#9a9080', marginRight: '8px' }}>Rejection reason:</span>
                        {leave.rejection_reason || 'No reason provided'}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
