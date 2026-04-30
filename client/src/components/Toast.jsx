import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const icons = {
  success: <CheckCircle size={18} color="#5CBF8A" />,
  error:   <XCircle    size={18} color="#E06060" />,
  warning: <AlertTriangle size={18} color="#E4B84D" />,
};

const colors = {
  success: { border: '#5CBF8A', bg: 'rgba(92, 191, 138, 0.1)' },
  error:   { border: '#E06060', bg: 'rgba(224, 96, 96, 0.1)'  },
  warning: { border: '#E4B84D', bg: 'rgba(228, 184, 77, 0.1)' },
};

function ToastItem({ toast }) {
  const removeToast = useAppStore((s) => s.removeToast);
  const c = colors[toast.type] || colors.success;

  return (
    <div
      className="toast-enter"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        background: '#1A1814',
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.border}`,
        borderRadius: '10px',
        padding: '12px 16px',
        minWidth: '300px',
        maxWidth: '380px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        marginBottom: '8px',
      }}
    >
      <span style={{ marginTop: '1px', flexShrink: 0 }}>{icons[toast.type] || icons.success}</span>
      <span style={{ flex: 1, fontSize: '14px', color: '#F5F0E8', lineHeight: 1.5 }}>
        {toast.message}
      </span>
      <button
        onClick={() => removeToast(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#5A5248',
          padding: '2px',
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default function Toast() {
  const toasts = useAppStore((s) => s.toasts);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column-reverse',
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
