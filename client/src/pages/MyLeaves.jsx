import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, Trash2, CalendarPlus, RefreshCw
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
    } catch {
      addToast('Failed to load leave history', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMyLeaves(); }, []);

  const handleCancel = async () => {
    try {
      await cancelLeave(cancelId);
      addToast('Leave request cancelled', 'success');
      setLeaves(leaves.filter(l => l._id !== cancelId));
    } catch {
      addToast('Failed to cancel request', 'error');
    } finally {
      setCancelId(null);
    }
  };

  return (
    <div className="fade-in" style={{ padding: '36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '38px', fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>My Leaves</h2>
          <p style={{ color: '#9a9080', fontSize: '13px', marginTop: '6px' }}>Track and manage your personal leave history</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={fetchMyLeaves} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => navigate('/apply-leave')} className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}>
            <CalendarPlus size={18} /> Apply New
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: '24px' }}>
        <LeaveTable
          leaves={leaves}
          loading={loading}
          showEmployee={false}
          expandRejection={true}
          actions={(leave) => (
            leave.status === 'Pending' && (
              <button
                onClick={() => setCancelId(leave._id)}
                className="btn-ghost"
                style={{ padding: '8px', color: '#5a5248' }}
                title="Cancel Request"
                onMouseEnter={e => e.currentTarget.style.color = '#e06060'}
                onMouseLeave={e => e.currentTarget.style.color = '#5a5248'}
              >
                <Trash2 size={18} />
              </button>
            )
          )}
        />
      </div>

      {/* Empty State */}
      {leaves.length === 0 && !loading && (
        <div className="card" style={{ padding: '80px 40px', textAlign: 'center', borderStyle: 'dashed', background: 'rgba(201,168,76,0.01)' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'rgba(201,168,76,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', color: '#c9a84c'
          }}>
            <ClipboardList size={36} style={{ opacity: 0.6 }} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#f5f0e8', marginBottom: '10px' }}>No leave requests yet</h3>
          <p style={{ fontSize: '14px', color: '#9a9080', marginBottom: '32px', maxWidth: '400px', margin: '0 auto 32px' }}>
            Your leave history will appear here once you submit your first application.
          </p>
          <button onClick={() => navigate('/apply-leave')} className="btn-gold" style={{ padding: '12px 36px' }}>
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
