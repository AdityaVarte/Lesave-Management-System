import { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const CONFIG = {
  success: { icon: CheckCircle, color: '#5cbf8a', bg: 'rgba(92,191,138,0.08)',  border: 'rgba(92,191,138,0.25)' },
  error:   { icon: XCircle,     color: '#e06060', bg: 'rgba(224,96,96,0.08)',   border: 'rgba(224,96,96,0.25)'  },
  warning: { icon: AlertTriangle,color: '#e4b84d', bg: 'rgba(228,184,77,0.08)', border: 'rgba(228,184,77,0.25)' },
  info:    { icon: Info,         color: '#7090c0', bg: 'rgba(112,144,192,0.08)', border: 'rgba(112,144,192,0.25)'},
};

function ToastItem({ toast }) {
  const removeToast = useAppStore((s) => s.removeToast);
  const cfg = CONFIG[toast.type] || CONFIG.info;
  const IconComp = cfg.icon;

  useEffect(() => {
    const timer = setTimeout(() => removeToast(toast.id), 4200);
    return () => clearTimeout(timer);
  }, [toast.id, removeToast]);

  return (
    <div
      className="toast-enter"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '10px',
        background: '#111009',
        border: `1px solid ${cfg.border}`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: '10px',
        padding: '12px 14px',
        minWidth: '300px', maxWidth: '380px',
        boxShadow: `0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.3)`,
        marginBottom: '8px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle bg tint */}
      <div style={{ position: 'absolute', inset: 0, background: cfg.bg, pointerEvents: 'none' }} />

      <span style={{ marginTop: '1px', flexShrink: 0, position: 'relative' }}>
        <IconComp size={17} color={cfg.color} />
      </span>
      <span style={{ flex: 1, fontSize: '13.5px', color: '#f5f0e8', lineHeight: 1.55, position: 'relative' }}>
        {toast.message}
      </span>
      <button
        onClick={() => removeToast(toast.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#5a5248', padding: '2px', flexShrink: 0,
          lineHeight: 1, position: 'relative', transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#9a9080'}
        onMouseLeave={e => e.currentTarget.style.color = '#5a5248'}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function Toast() {
  const toasts = useAppStore((s) => s.toasts);

  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      display: 'flex', flexDirection: 'column-reverse',
      pointerEvents: 'none',
    }}>
      <div style={{ pointerEvents: 'auto' }}>
        {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
      </div>
    </div>
  );
}
