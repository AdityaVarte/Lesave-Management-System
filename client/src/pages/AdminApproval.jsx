import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, XCircle, AlertCircle, Loader2, MessageSquare
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getAdminDashboard } from '../api/analyticsApi';
import { approveLeave, rejectLeave } from '../api/leaveApi';
import LeaveTable from '../components/LeaveTable';
import ConfirmDialog from '../components/ConfirmDialog';

export default function AdminApproval() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' or 'reject'
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { addToast, fetchPendingCount } = useAppStore();

  const fetchPending = async () => {
    setLoading(true);
    try {
      const response = await getAdminDashboard();
      setLeaves(response.data.latestPending);
    } catch {
      addToast('Failed to load pending requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPending(); }, []);

  const handleAction = async () => {
    if (actionType === 'reject' && !reason.trim()) {
      return addToast('Please provide a reason for rejection', 'warning');
    }

    setSubmitting(true);
    try {
      if (actionType === 'approve') {
        await approveLeave(actionId);
        addToast('Leave request approved', 'success');
      } else {
        await rejectLeave(actionId, { rejection_reason: reason });
        addToast('Leave request rejected', 'success');
      }
      setLeaves(leaves.filter(l => l._id !== actionId));
      fetchPendingCount();
    } catch (err) {
      addToast(err.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setSubmitting(false);
      setActionId(null);
      setActionType(null);
      setReason('');
    }
  };

  return (
    <div className="fade-in" style={{ padding: '36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '38px', fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>Pending Approvals</h2>
          <p style={{ color: '#9a9080', fontSize: '13px', marginTop: '6px' }}>Review and action employee leave applications</p>
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <LeaveTable
          leaves={leaves}
          loading={loading}
          showEmployee={true}
          actions={(leave) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => { setActionId(leave._id); setActionType('approve'); }}
                className="btn-ghost"
                style={{ padding: '8px', color: '#5CBF8A' }}
                title="Approve"
              >
                <CheckCircle2 size={18} />
              </button>
              <button
                onClick={() => { setActionId(leave._id); setActionType('reject'); }}
                className="btn-ghost"
                style={{ padding: '8px', color: '#e06060' }}
                title="Reject"
              >
                <XCircle size={18} />
              </button>
            </div>
          )}
        />
      </div>

      {/* Empty State */}
      {leaves.length === 0 && !loading && (
        <div style={{ padding: '100px 40px', textAlign: 'center' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'rgba(92,191,138,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', color: '#5CBF8A'
          }}>
            <CheckCircle2 size={32} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#f5f0e8', marginBottom: '8px' }}>All caught up!</h3>
          <p style={{ fontSize: '14px', color: '#9a9080' }}>No pending leave requests to review at the moment.</p>
        </div>
      )}

      {/* Action Dialog */}
      <ConfirmDialog
        isOpen={!!actionId}
        title={actionType === 'approve' ? 'Approve Application' : 'Reject Application'}
        confirmText={actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
        danger={actionType === 'reject'}
        onConfirm={handleAction}
        onCancel={() => { setActionId(null); setActionType(null); setReason(''); }}
      >
        <div style={{ marginTop: '16px' }}>
          {actionType === 'reject' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(224,96,96,0.05)', borderRadius: '8px', border: '1px solid rgba(224,96,96,0.15)' }}>
                <AlertCircle size={18} color="#e06060" />
                <p style={{ fontSize: '13px', color: '#f5f0e8' }}>You are rejecting this request. Please state the reason below.</p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#5a5248', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>
                  <MessageSquare size={10} style={{ marginRight: '4px' }} /> Rejection Reason
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a constructive reason for rejection..."
                  rows={4}
                  style={{ resize: 'none' }}
                />
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '14px', color: '#9a9080' }}>
              Are you sure you want to approve this leave request? The employee will be notified immediately.
            </p>
          )}
          {submitting && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px', color: '#c9a84c', fontSize: '13px' }}>
              <Loader2 className="animate-spin" size={16} /> Processing request...
            </div>
          )}
        </div>
      </ConfirmDialog>
    </div>
  );
}
