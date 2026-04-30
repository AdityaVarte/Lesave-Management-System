import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Confirm', danger = false }) {
  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onCancel(); };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}
    onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="fade-in" style={{
        background: '#1A1814',
        border: `1px solid ${danger ? 'rgba(224,96,96,0.3)' : '#2A2418'}`,
        borderRadius: '14px',
        padding: '28px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '20px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
            background: danger ? 'rgba(224,96,96,0.1)' : 'rgba(201,168,76,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} color={danger ? '#E06060' : '#C9A84C'} />
          </div>
          <div>
            <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#F5F0E8', marginBottom: '6px' }}>{title}</h3>
            <p style={{ fontSize: '14px', color: '#9A9080', lineHeight: 1.6 }}>{message}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel} style={{ padding: '9px 18px' }}>Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              background: danger ? 'linear-gradient(135deg, #E06060, #C84040)' : 'linear-gradient(135deg, #C9A84C, #E4B84D)',
              color: '#0F0F0F',
              border: 'none', borderRadius: '8px', padding: '9px 18px',
              fontWeight: 600, cursor: 'pointer', fontSize: '14px',
              fontFamily: '"DM Sans", sans-serif',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
