const statusConfig = {
  Pending:  {
    color: '#e4b84d',
    bg: 'rgba(228,184,77,0.10)',
    border: 'rgba(228,184,77,0.25)',
    dot: '#e4b84d',
    glow: 'rgba(228,184,77,0.4)',
  },
  Approved: {
    color: '#5cbf8a',
    bg: 'rgba(92,191,138,0.10)',
    border: 'rgba(92,191,138,0.25)',
    dot: '#5cbf8a',
    glow: 'rgba(92,191,138,0.4)',
  },
  Rejected: {
    color: '#e06060',
    bg: 'rgba(224,96,96,0.10)',
    border: 'rgba(224,96,96,0.25)',
    dot: '#e06060',
    glow: 'rgba(224,96,96,0.4)',
  },
};

export default function StatusBadge({ status }) {
  const cfg = statusConfig[status] || statusConfig.Pending;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      whiteSpace: 'nowrap',
    }}>
      {/* Animated pulsing dot for Pending */}
      <span style={{
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: cfg.dot,
        flexShrink: 0,
        boxShadow: status === 'Pending' ? `0 0 0 2px ${cfg.glow}` : 'none',
        animation: status === 'Pending' ? 'pulseGold 2s ease infinite' : 'none',
      }} />
      {status}
    </span>
  );
}
