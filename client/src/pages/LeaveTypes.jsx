import { useEffect, useState, useCallback } from 'react';
import {
  Plus, Pencil, Trash2, ShieldCheck, Clock
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType } from '../api/leaveTypeApi';
import SlidePanel from '../components/SlidePanel';
import ConfirmDialog from '../components/ConfirmDialog';

const labelStyle = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  color: '#5a5248', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '8px',
};

export default function LeaveTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({ type_name: '', total_days: 20, description: '', color: '#c9a84c' });

  const { addToast } = useAppStore();

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getLeaveTypes();
      setTypes(r?.data || []);
    } catch {
      addToast('Failed to load leave policies', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Asynchronous leave policies fetch on component mount
    fetchTypes();
  }, [fetchTypes]);

  const openPanel = (type = null) => {
    setEditingType(type);
    if (type) setFormData({ type_name: type.type_name, total_days: type.total_days, description: type.description || '', color: type.color || '#c9a84c' });
    else setFormData({ type_name: '', total_days: 20, description: '', color: '#c9a84c' });
    setPanelOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingType) {
        const r = await updateLeaveType(editingType._id, formData);
        setTypes(types.map(t => t._id === editingType._id ? r.data : t));
        addToast('Policy updated', 'success');
      } else {
        const r = await createLeaveType(formData);
        setTypes([...types, r.data]);
        addToast('Policy created', 'success');
      }
      setPanelOpen(false);
    } catch (err) {
      addToast(err.response?.data?.message || 'Action failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteLeaveType(deleteId);
      setTypes(types.filter(t => t._id !== deleteId));
      addToast('Policy removed', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Deletion failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="fade-in" style={{ padding: '36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '38px', fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>Leave Policy</h2>
          <p style={{ color: '#9a9080', fontSize: '13px', marginTop: '6px' }}>Configure available leave categories and restrictions</p>
        </div>
        <button onClick={() => openPanel()} className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}>
          <Plus size={18} /> New Category
        </button>
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="card skeleton" style={{ height: '220px' }} />)
        ) : types.map((type) => (
          <div key={type._id} className="card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '4px', height: '32px', background: type.color, borderRadius: '4px' }} />
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f5f0e8', fontFamily: "'DM Sans', sans-serif" }}>{type.type_name}</h3>
                  <p style={{ fontSize: '11px', color: '#5a5248', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.08em', marginTop: '2px' }}>Standard Category</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => openPanel(type)} className="btn-ghost" style={{ padding: '8px' }}><Pencil size={15} /></button>
                <button onClick={() => setDeleteId(type._id)} className="btn-ghost" style={{ padding: '8px', color: '#5a5248' }} onMouseEnter={e => e.currentTarget.style.color = '#e06060'} onMouseLeave={e => e.currentTarget.style.color = '#5a5248'}><Trash2 size={15} /></button>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: '#9a9080' }}>Annual Allowance</span>
                <span style={{ fontSize: '18px', fontWeight: 700, color: type.color, fontFamily: "'Cormorant Garamond', serif" }}>{type.total_days} Days</span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: '60%', height: '100%', background: type.color, opacity: 0.6 }} />
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#9a9080', lineHeight: 1.5, flex: 1 }}>{type.description || 'No description provided for this leave category.'}</p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingTop: '16px', borderTop: '1px solid #1a1610' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#5a5248', fontWeight: 700, textTransform: 'uppercase' }}>
                <ShieldCheck size={13} color="#5CBF8A" /> Active
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#5a5248', fontWeight: 700, textTransform: 'uppercase' }}>
                <Clock size={13} color="#c9a84c" /> Carry Forward
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Slide Panel */}
      <SlidePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} title={editingType ? 'Edit Leave Category' : 'Create New Category'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Category Name</label>
            <input value={formData.type_name} onChange={e => setFormData({ ...formData, type_name: e.target.value })} placeholder="e.g. Wellness Leave" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Annual Days</label>
              <input type="number" value={formData.total_days} onChange={e => setFormData({ ...formData, total_days: parseInt(e.target.value) })} min={1} required />
            </div>
            <div>
              <label style={labelStyle}>Theme Color</label>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                {['#c9a84c', '#e06060', '#5cbf8a', '#60a5fa', '#a78bfa'].map(c => (
                  <button
                    key={c} type="button"
                    onClick={() => setFormData({ ...formData, color: c })}
                    style={{
                      width: '28px', height: '28px', borderRadius: '50%', background: c, border: formData.color === c ? '2px solid #f5f0e8' : 'none', cursor: 'pointer', transition: 'transform 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Explain who can use this leave and under what conditions..." rows={4} style={{ resize: 'none' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingTop: '20px', borderTop: '1px solid #1a1610' }}>
            <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setPanelOpen(false)}>Cancel</button>
            <button type="submit" className="btn-gold" style={{ flex: 1 }}>{editingType ? 'Save Changes' : 'Create Category'}</button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Leave Category"
        message="Are you sure you want to remove this leave category? This will not affect existing leave records but will prevent future applications."
        confirmText="Yes, Delete"
        danger={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
