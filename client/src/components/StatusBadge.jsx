const statusConfig = {
  Pending:  { color: '#E4B84D', bg: 'rgba(228, 184, 77, 0.12)',  dot: '#E4B84D' },
  Approved: { color: '#5CBF8A', bg: 'rgba(92, 191, 138, 0.12)',  dot: '#5CBF8A' },
  Rejected: { color: '#E06060', bg: 'rgba(224, 96, 96, 0.12)',   dot: '#E06060' },
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
      fontSize: '12px',
      fontWeight: 500,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.color}30`,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0,
      }} />
      {status}
    </span>
  );
}
