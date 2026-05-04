import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/dashboard':        'Dashboard',
  '/apply-leave':      'Apply for Leave',
  '/my-leaves':        'My Leaves',
  '/leave-report':     'Leave Report',
  '/profile':          'Account Settings',
  '/admin/approvals':  'Approvals',
  '/admin/employees':  'Employee Management',
  '/admin/leave-types':'Leave Policies',
};

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div style={{ textAlign: 'right', lineHeight: 1.2 }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontWeight: 600, color: '#c9a84c', letterSpacing: '0.02em' }}>
        {timeStr}
      </div>
      <div style={{ fontSize: '10px', color: '#5a5248', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '1px' }}>
        {dateStr}
      </div>
    </div>
  );
}

export default function Topbar() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || 'LeaveFlow';

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 'var(--sidebar-width)',
      right: 0,
      height: 'var(--topbar-height)',
      background: 'rgba(12,11,8,0.85)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #231e12',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
    }}>
      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '3px', height: '18px', background: 'linear-gradient(180deg, #c9a84c, #e4b84d)', borderRadius: '2px' }} />
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '22px', fontWeight: 600, color: '#f5f0e8', letterSpacing: '0.01em' }}>
          {title}
        </h1>
      </div>

      {/* Live clock */}
      <LiveClock />
    </header>
  );
}
