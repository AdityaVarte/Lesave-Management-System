import { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmDialog({
  isOpen, title, message,
  onConfirm, onCancel,
  confirmText = 'Confirm',
  danger = false,
}) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const accentColor = danger ? '#e06060' : '#c9a84c';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="fade-in"
        style={{
          background: '#111009',
          border: `1px solid ${danger ? 'rgba(224,96,96,0.25)' : '#231e12'}`,
          borderRadius: '12px',
          maxWidth: '420px', width: '100%',
          overflow: 'hidden',
          boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 0 1px ${accentColor}15`,
        }}
      >
        {/* Top accent */}
        <div style={{ height: '2px', background: `linear-gradient(90deg, ${accentColor}, ${accentColor}60, transparent)` }} />

        <div style={{ padding: '24px 24px 20px' }}>
          {/* Icon + Title */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
              background: `${accentColor}12`,
              border: `1px solid ${accentColor}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={19} color={accentColor} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: '20px', fontWeight: 600,
                color: '#f5f0e8', marginBottom: '6px', lineHeight: 1.2,
              }}>
                {title}
              </h3>
              <p style={{ fontSize: '13.5px', color: '#9a9080', lineHeight: 1.65 }}>{message}</p>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button className="btn-ghost" onClick={onCancel} style={{ padding: '9px 20px' }}>
              Cancel
            </button>
            <button
              onClick={onConfirm}
              style={{
                background: danger
                  ? 'linear-gradient(135deg, #e06060, #c84040)'
                  : 'linear-gradient(135deg, #c9a84c, #e4b84d)',
                color: '#0c0b08', border: 'none', borderRadius: '8px',
                padding: '9px 20px', fontWeight: 700, cursor: 'pointer',
                fontSize: '13.5px', fontFamily: "'DM Sans', sans-serif",
                transition: 'opacity 0.15s, transform 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = ''; }}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
