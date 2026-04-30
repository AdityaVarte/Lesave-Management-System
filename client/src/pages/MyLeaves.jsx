import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, 
  Search, 
  Filter, 
  Trash2, 
  CalendarPlus,
  RefreshCw
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getLeaves, cancelLeave } from '../api/leaveApi';
import LeaveTable from '../components/LeaveTable';
import ConfirmDialog from '../components/ConfirmDialog';

export default function MyLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelId, setCancelId] = useState(null);
  const { addToast } = useAppStore();
  const navigate = useNavigate();

  const fetchMyLeaves = async () => {
    setLoading(true);
    try {
      const response = await getLeaves();
      setLeaves(response.data.leaves);
    } catch (err) {
      addToast('Failed to load your leave history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLeaves();
  }, []);

  const handleCancel = async () => {
    try {
      await cancelLeave(cancelId);
      addToast('Leave request cancelled', 'success');
      setLeaves(leaves.filter(l => l._id !== cancelId));
    } catch (err) {
      addToast('Failed to cancel request', 'error');
    } finally {
      setCancelId(null);
    }
  };

  return (
    <div className="p-8 space-y-8 fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl font-bold text-ink-primary">My Leaves</h2>
          <p className="text-ink-muted text-sm mt-1">Track and manage your leave requests</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchMyLeaves}
            className="btn-ghost flex items-center gap-2"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button 
            onClick={() => navigate('/apply-leave')}
            className="btn-gold flex items-center gap-2"
          >
            <CalendarPlus size={18} /> Apply New
          </button>
        </div>
      </div>

      <div className="card glow-gold">
        <div className="p-0">
          <LeaveTable 
            leaves={leaves} 
            loading={loading}
            showEmployee={false}
            expandRejection={true}
            actions={(leave) => (
              leave.status === 'Pending' && (
                <button 
                  onClick={() => setCancelId(leave._id)}
                  className="p-2 text-ink-hint hover:text-rejected hover:bg-rejected/10 rounded-lg transition-all"
                  title="Cancel Request"
                >
                  <Trash2 size={18} />
                </button>
              )
            )}
          />
        </div>
      </div>

      {leaves.length === 0 && !loading && (
        <div className="text-center py-20 card border-dashed border-2 border-border/50">
          <div className="w-20 h-20 bg-gold-dim/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ClipboardList size={36} className="text-gold opacity-50" />
          </div>
          <h3 className="text-xl font-bold text-ink-primary mb-2">No leave requests yet</h3>
          <p className="text-ink-muted mb-6">Apply for your first leave to see it here.</p>
          <button 
            onClick={() => navigate('/apply-leave')}
            className="btn-gold px-8"
          >
            Get Started
          </button>
        </div>
      )}

      <ConfirmDialog 
        isOpen={!!cancelId}
        title="Cancel Leave Request"
        message="Are you sure you want to cancel this pending leave request? This action cannot be undone."
        confirmText="Cancel Request"
        danger={true}
        onConfirm={handleCancel}
        onCancel={() => setCancelId(null)}
      />
    </div>
  );
}
