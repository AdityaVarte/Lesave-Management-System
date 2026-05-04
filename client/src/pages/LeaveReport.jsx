import React, { useEffect, useState } from 'react';
import {
  Download, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getLeaves } from '../api/leaveApi';
import { exportToCSV } from '../utils/csvExport';
import LeaveTable from '../components/LeaveTable';

const labelStyle = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  color: '#5a5248', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px',
};

export default function LeaveReport() {
  const [data, setData] = useState({ leaves: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', type: '', department: '', month: '' });

  const { user, addToast } = useAppStore();
  const isAdmin = user.role === 'admin';

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const response = await getLeaves({ ...filters, page, limit: 10 });
      setData(response.data);
    } catch {
      addToast('Failed to load report data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaves(); }, [page, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const clearFilters = () => { setFilters({ status: '', type: '', department: '', month: '' }); setPage(1); };

  const handleExport = () => {
    exportToCSV(data.leaves, 'Leave_Flow_Report');
    addToast('CSV export started', 'success');
  };

  return (
    <div className="fade-in" style={{ padding: '36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '38px', fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>Leave Report</h2>
          <p style={{ color: '#9a9080', fontSize: '13px', marginTop: '6px' }}>Detailed analysis and workforce records</p>
        </div>
        <button
          onClick={handleExport}
          className="btn-gold"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}
          disabled={data.leaves.length === 0}
        >
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Filters Card */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '20px', alignItems: 'flex-end' }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Type</label>
            <select name="type" value={filters.type} onChange={handleFilterChange}>
              <option value="">All Types</option>
              <option value="Casual">Casual</option>
              <option value="Sick">Sick</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          {isAdmin && (
            <div>
              <label style={labelStyle}>Department</label>
              <select name="department" value={filters.department} onChange={handleFilterChange}>
                <option value="">All Departments</option>
                {['Engineering', 'Design', 'Finance', 'HR', 'Marketing', 'Operations'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={labelStyle}>Month</label>
            <input type="month" name="month" value={filters.month} onChange={handleFilterChange} />
          </div>

          <button onClick={clearFilters} className="btn-ghost" style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <XCircle size={16} /> Reset
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <LeaveTable leaves={data.leaves} loading={loading} showEmployee={isAdmin} />

        {/* Pagination */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid #1a1610', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '12px', color: '#5a5248', fontWeight: 500 }}>
            Showing <span style={{ color: '#f5f0e8' }}>{(page - 1) * 10 + 1}</span> to <span style={{ color: '#f5f0e8' }}>{Math.min(page * 10, data.total)}</span> of <span style={{ color: '#f5f0e8' }}>{data.total}</span> records
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              disabled={page === 1 || loading}
              onClick={() => setPage(p => p - 1)}
              style={{
                width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #231e12', background: 'none', color: '#9a9080',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === 1 ? 'default' : 'pointer', opacity: page === 1 ? 0.3 : 1, transition: 'all 0.15s'
              }}
              onMouseEnter={e => { if (page !== 1) e.currentTarget.style.borderColor = '#c9a84c'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#231e12'; }}
            >
              <ChevronLeft size={18} />
            </button>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[...Array(data.totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '8px', border: 'none',
                    background: page === i + 1 ? '#c9a84c' : 'rgba(255,255,255,0.03)',
                    color: page === i + 1 ? '#0c0b08' : '#9a9080',
                    fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              disabled={page === data.totalPages || loading}
              onClick={() => setPage(p => p + 1)}
              style={{
                width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #231e12', background: 'none', color: '#9a9080',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: page === data.totalPages ? 'default' : 'pointer', opacity: page === data.totalPages ? 0.3 : 1, transition: 'all 0.15s'
              }}
              onMouseEnter={e => { if (page !== data.totalPages) e.currentTarget.style.borderColor = '#c9a84c'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#231e12'; }}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
