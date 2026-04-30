export default function MetricCard({ title, value, subtitle, icon: Icon, color = '#C9A84C', glowColor }) {
  const glow = glowColor || `${color}20`;
  return (
    <div style={{
      background: '#1A1814',
      border: `1px solid #2A2418`,
      borderRadius: '14px',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
      transition: 'box-shadow 0.3s, border-color 0.3s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = `0 0 30px ${glow}`;
      e.currentTarget.style.borderColor = `${color}40`;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = '#2A2418';
    }}
    >
      {/* Background accent */}
      <div style={{
        position: 'absolute', top: '-20px', right: '-20px',
        width: '100px', height: '100px', borderRadius: '50%',
        background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: '12px', color: '#9A9080', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
            {title}
          </p>
          <p style={{
            fontSize: 'min(36px, 8vw)', fontWeight: 700, color,
            fontFamily: '"Cormorant Garamond", serif',
            lineHeight: 1,
            whiteSpace: 'nowrap'
          }}>
            {value}
          </p>
          {subtitle && (
            <p style={{ fontSize: '13px', color: '#5A5248', marginTop: '6px' }}>{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div style={{
            width: '44px', height: '44px', borderRadius: '10px',
            background: `${color}15`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon size={22} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}
