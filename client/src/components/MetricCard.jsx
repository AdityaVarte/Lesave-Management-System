export default function MetricCard({ title, value, subtitle, icon: Icon, color = '#c9a84c', glowColor }) {
  const glow = glowColor || `${color}18`;

  return (
    <div
      className="card card-gold-top"
      style={{ padding: '22px 24px', transition: 'box-shadow 0.25s, border-color 0.25s' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 1px ${color}30, 0 8px 32px ${glow}`;
        e.currentTarget.style.borderColor = `${color}35`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.borderColor = '';
      }}
    >
      {/* Top gradient line override with accent color */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
        background: `linear-gradient(90deg, ${color} 0%, ${color}80 60%, transparent 100%)`,
      }} />

      {/* Radial background glow */}
      <div style={{
        position: 'absolute', top: '-30px', right: '-20px',
        width: '110px', height: '110px', borderRadius: '50%',
        background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: '10px', fontWeight: 700, color: '#5a5248',
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '10px',
          }}>
            {title}
          </p>
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 'clamp(28px, 5vw, 38px)',
            fontWeight: 700,
            color,
            lineHeight: 1,
            letterSpacing: '-0.01em',
          }}>
            {value}
          </p>
          {subtitle && (
            <p style={{ fontSize: '12px', color: '#5a5248', marginTop: '8px' }}>{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div style={{
            width: '42px', height: '42px', borderRadius: '10px',
            background: `${color}12`,
            border: `1px solid ${color}20`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginLeft: '12px',
          }}>
            <Icon size={20} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}
