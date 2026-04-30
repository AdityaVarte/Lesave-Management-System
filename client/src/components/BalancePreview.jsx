import { calcWorkingDays } from '../utils/workingDays';

export default function BalancePreview({ startDate, endDate, isHalfDay, totalLeaves, usedLeaves, pendingLeaves }) {
  const workingDays = calcWorkingDays(startDate, endDate, isHalfDay);
  const available = totalLeaves - usedLeaves - pendingLeaves;
  const afterApply = available - workingDays;

  const getColor = () => {
    if (afterApply < 0) return '#E06060';
    if (afterApply < 2) return '#E06060';
    if (afterApply <= 5) return '#E4B84D';
    return '#5CBF8A';
  };

  const color = getColor();

  if (!startDate || !endDate) return null;

  return (
    <div style={{
      background: '#221E14',
      border: `1px solid ${color}30`,
      borderRadius: '10px',
      padding: '16px',
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
      gap: '12px',
      marginTop: '4px',
    }}>
      {[
        { label: 'Working Days', value: workingDays, color: '#C9A84C' },
        { label: 'Balance Before', value: available,  color: '#9A9080' },
        { label: 'Balance After',  value: afterApply, color },
      ].map(({ label, value, color: c }) => (
        <div key={label} style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: c, fontFamily: '"Cormorant Garamond", serif' }}>
            {value}
          </div>
          <div style={{ fontSize: '11px', color: '#5A5248', marginTop: '2px' }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
