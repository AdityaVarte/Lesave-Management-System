import React, { useEffect, useState } from 'react';
import { 
  CheckSquare, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Clock,
  Loader2,
  FileCheck2,
  RefreshCw
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getPendingLeaves, approveLeave, rejectLeave } from '../api/leaveApi';
import LeaveTable from '../components/LeaveTable';
import ConfirmDialog from '../components/ConfirmDialog';

export default function AdminApproval() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [rejectingLeave, setRejectingLeave] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [bulkApproving, setBulkApproving] = useState(false);
  
  const { addToast, setPendingCount } = useAppStore();

  const fetchPending = async () => {
    setLoading(true);
    try {
      const response = await getPendingLeaves();
      setLeaves(response.data);
      setPendingCount(response.data.length);
    } catch (err) {
      addToast('Failed to load pending requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await approveLeave(id);
      addToast('Request approved successfully', 'success');
      const updated = leaves.filter(l => l._id !== id);
      setLeaves(updated);
      setPendingCount(updated.length);
    } catch (err) {
      addToast('Approval failed', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return addToast('Rejection reason is required', 'warning');
    
    setProcessingId(rejectingLeave._id);
    try {
      await rejectLeave(rejectingLeave._id, { rejection_reason: rejectionReason });
      addToast('Request rejected', 'success');
      const updated = leaves.filter(l => l._id !== rejectingLeave._id);
      setLeaves(updated);
      setPendingCount(updated.length);
      setRejectingLeave(null);
      setRejectionReason('');
    } catch (err) {
      addToast('Rejection failed', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAll = async () => {
    setProcessingId('bulk');
    try {
      for (const leave of leaves) {
        await approveLeave(leave._id);
      }
      addToast(`Approved ${leaves.length} requests`, 'success');
      setLeaves([]);
      setPendingCount(0);
    } catch (err) {
      addToast('Some approvals failed', 'error');
      fetchPending();
    } finally {
      setProcessingId(null);
      setBulkApproving(false);
    }
  };

  return (
    <div className="p-8 space-y-8 fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl font-bold text-ink-primary">Pending Approvals</h2>
          <p className="text-ink-muted text-sm mt-1">Review and action leave applications</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={fetchPending}
            className="btn-ghost flex items-center gap-2"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {leaves.length > 0 && (
            <button 
              onClick={() => setBulkApproving(true)}
              className="btn-gold flex items-center gap-2 px-6"
              disabled={processingId === 'bulk'}
            >
              {processingId === 'bulk' ? <Loader2 className="animate-spin" /> : <FileCheck2 size={18} />} 
              Approve All
            </button>
          )}
        </div>
      </div>

      <div className="card glow-gold">
        <div className="p-0">
          <LeaveTable 
            leaves={leaves} 
            loading={loading}
            actions={(leave) => (
              <div className="flex items-center gap-2">
                <button 
                  disabled={processingId === leave._id}
                  onClick={() => handleApprove(leave._id)}
                  className="p-2 text-status-approved hover:bg-status-approved/10 rounded-lg transition-all"
                  title="Approve"
                >
                  {processingId === leave._id ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                </button>
                <button 
                  disabled={processingId === leave._id}
                  onClick={() => setRejectingLeave(leave)}
                  className="p-2 text-rejected hover:bg-rejected/10 rounded-lg transition-all"
                  title="Reject"
                >
                  <XCircle size={18} />
                </button>
              </div>
            )}
          />
        </div>
      </div>

      {leaves.length === 0 && !loading && (
        <div className="text-center py-24 bg-primary-card/30 rounded-2xl border border-border">
          <div className="w-20 h-20 bg-status-approved/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckSquare size={36} className="text-status-approved opacity-80" />
          </div>
          <h3 className="font-display text-3xl font-bold text-ink-primary mb-2">All caught up!</h3>
          <p className="text-ink-muted">There are no pending leave requests to review.</p>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingLeave && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="card p-8 w-full max-w-md glow-gold-intense">
            <h3 className="text-xl font-bold text-ink-primary mb-2">Reject Request</h3>
            <p className="text-ink-muted text-sm mb-6">
              Please provide a reason for rejecting <span className="text-gold">{rejectingLeave.employee_snapshot.name}</span>'s request.
            </p>
            
            <textarea
              autoFocus
              className="w-full h-32 mb-6"
              placeholder="e.g. Critical project deadline during this period..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />

            <div className="flex gap-3 justify-end">
              <button 
                className="btn-ghost" 
                onClick={() => { setRejectingLeave(null); setRejectionReason(''); }}
              >
                Cancel
              </button>
              <button 
                className="btn-gold bg-rejected hover:opacity-90 text-primary-card"
                onClick={handleReject}
                disabled={processingId === rejectingLeave._id}
              >
                {processingId === rejectingLeave._id ? <Loader2 className="animate-spin" /> : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={bulkApproving}
        title="Approve All Requests"
        message={`Are you sure you want to approve all ${leaves.length} pending leave requests?`}
        confirmText="Yes, Approve All"
        onConfirm={handleApproveAll}
        onCancel={() => setBulkApproving(false)}
      />
    </div>
  );
}
