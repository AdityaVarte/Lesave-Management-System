import React, { useEffect, useState } from 'react';
import { 
  BarChart2, 
  Download, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getLeaves } from '../api/leaveApi';
import { exportToCSV } from '../utils/csvExport';
import LeaveTable from '../components/LeaveTable';

export default function LeaveReport() {
  const [data, setData] = useState({ leaves: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    department: '',
    month: '',
  });
  
  const { user, addToast } = useAppStore();
  const isAdmin = user.role === 'admin';

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const response = await getLeaves({ ...filters, page, limit: 10 });
      setData(response.data);
    } catch (err) {
      addToast('Failed to load report data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, [page, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ status: '', type: '', department: '', month: '' });
    setPage(1);
  };

  const handleExport = () => {
    exportToCSV(data.leaves, 'Leave_Flow_Report');
    addToast('CSV export started', 'success');
  };

  return (
    <div className="p-8 space-y-8 fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl font-bold text-ink-primary">Leave Report</h2>
          <p className="text-ink-muted text-sm mt-1">Detailed analysis and records</p>
        </div>
        <button 
          onClick={handleExport}
          className="btn-gold flex items-center gap-2 px-6"
          disabled={data.leaves.length === 0}
        >
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Filters Card */}
      <div className="card p-6 border-gold-dim/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Status</label>
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Type</label>
            <select name="type" value={filters.type} onChange={handleFilterChange}>
              <option value="">All Types</option>
              <option value="Casual">Casual</option>
              <option value="Sick">Sick</option>
              <option value="Paid">Paid</option>
            </select>
          </div>

          {isAdmin && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Department</label>
              <select name="department" value={filters.department} onChange={handleFilterChange}>
                <option value="">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Finance">Finance</option>
                <option value="HR">HR</option>
                <option value="Marketing">Marketing</option>
                <option value="Operations">Operations</option>
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Month</label>
            <input 
              type="month" 
              name="month" 
              value={filters.month} 
              onChange={handleFilterChange} 
            />
          </div>

          <div className="flex items-end">
            <button 
              onClick={clearFilters}
              className="btn-ghost w-full flex items-center justify-center gap-2 py-[11px]"
            >
              <XCircle size={16} /> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card glow-gold">
        <div className="p-0">
          <LeaveTable 
            leaves={data.leaves} 
            loading={loading}
            showEmployee={isAdmin}
          />
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-border flex items-center justify-between">
          <p className="text-xs text-ink-hint font-medium">
            Showing <span className="text-ink-primary">{(page - 1) * 10 + 1}</span> to <span className="text-ink-primary">{Math.min(page * 10, data.total)}</span> of <span className="text-ink-primary">{data.total}</span> records
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={page === 1 || loading}
              onClick={() => setPage(p => p - 1)}
              className="p-2 rounded-lg border border-border text-ink-muted hover:text-gold hover:border-gold disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-1">
              {[...Array(data.totalPages)].map((_, i) => (
                <button
                  key={i + 1}
                  onClick={() => setPage(i + 1)}
                  className={`
                    w-8 h-8 rounded-lg text-xs font-bold transition-all
                    ${page === i + 1 
                      ? 'bg-gold text-primary shadow-[0_0_15px_rgba(201,168,76,0.3)]' 
                      : 'text-ink-muted hover:text-gold hover:bg-gold-dim/10'}
                  `}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button 
              disabled={page === data.totalPages || loading}
              onClick={() => setPage(p => p + 1)}
              className="p-2 rounded-lg border border-border text-ink-muted hover:text-gold hover:border-gold disabled:opacity-30 disabled:pointer-events-none transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
