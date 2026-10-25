import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarPlus,
  ClipboardList,
  BarChart2,
  CheckSquare,
  Users,
  Settings2,
  UserCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

function NavItem({ to, icon: Icon, label, badge }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 12px',
        borderRadius: '8px',
        textDecoration: 'none',
        position: 'relative',
        transition: 'all 0.15s',
        background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent',
        color: isActive ? '#f5f0e8' : '#9a9080',
        borderLeft: isActive ? '2px solid #c9a84c' : '2px solid transparent',
        marginBottom: '2px',
      })}
      onMouseEnter={(e) => {
        const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
        if (!isActive) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
          e.currentTarget.style.color = '#f5f0e8';
        }
      }}
      onMouseLeave={(e) => {
        const isActive = e.currentTarget.getAttribute('aria-current') === 'page';
        if (!isActive) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#9a9080';
        }
      }}
    >
      {({ isActive }) => (
        <>
          <Icon size={17} style={{ color: isActive ? '#c9a84c' : 'inherit', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: isActive ? 600 : 400, flex: 1 }}>{label}</span>
          {badge > 0 && (
            <span style={{
              background: 'linear-gradient(135deg, #c9a84c, #e4b84d)',
              color: '#0c0b08',
              fontSize: '10px',
              fontWeight: 800,
              padding: '1px 6px',
              borderRadius: '10px',
              minWidth: '18px',
              textAlign: 'center',
            }}>
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: '9px',
      fontWeight: 700,
      color: '#5a5248',
      textTransform: 'uppercase',
      letterSpacing: '0.15em',
      padding: '0 12px',
      marginBottom: '6px',
      marginTop: '20px',
    }}>
      {children}
    </p>
  );
}

export default function Sidebar() {
  const { user, logout, pendingCount } = useAppStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };
  const isAdmin = user?.role === 'admin';

  const renderSidebarContent = () => (
    <aside style={{
      width: '240px',
      background: '#0e0d0a',
      borderRight: '1px solid #1a1610',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Logo */}
      <div style={{ padding: '28px 20px 20px' }}>
        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '28px',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #c9a84c, #f0c060)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}>
          LeaveFlow
        </h1>
        <p style={{ fontSize: '9px', color: '#5a5248', textTransform: 'uppercase', letterSpacing: '0.18em', marginTop: '4px' }}>
          Workforce Intelligence
        </p>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #231e12, transparent)', margin: '0 16px' }} />

      {/* Nav */}
      <nav className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '16px 12px 0' }}>
        <SectionLabel>Main</SectionLabel>
        <NavItem to="/dashboard"    icon={LayoutDashboard} label="Dashboard" />
        <NavItem to="/apply-leave"  icon={CalendarPlus}    label="Apply Leave" />
        <NavItem to="/my-leaves"    icon={ClipboardList}   label="My Leaves" />
        <NavItem to="/leave-report" icon={BarChart2}       label="Leave Report" />
        <NavItem to="/profile"      icon={UserCircle}      label="Account Settings" />

        {isAdmin && (
          <>
            <SectionLabel>Admin</SectionLabel>
            <NavItem to="/admin/approvals"   icon={CheckSquare} label="Approvals"     badge={pendingCount} />
            <NavItem to="/admin/employees"   icon={Users}       label="Employees" />
            <NavItem to="/admin/leave-types" icon={Settings2}   label="Leave Policies" />
          </>
        )}
      </nav>

      {/* User Profile */}
      <div style={{ padding: '12px', borderTop: '1px solid #1a1610', marginTop: 'auto' }}>
        <NavLink
          to="/profile"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px',
            borderRadius: '8px',
            textDecoration: 'none',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(201,168,76,0.06)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {/* Avatar */}
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'rgba(201,168,76,0.12)',
            border: '1px solid rgba(201,168,76,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '15px', fontWeight: 700, color: '#c9a84c',
            fontFamily: "'Cormorant Garamond', serif",
            flexShrink: 0,
          }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#f5f0e8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </p>
            <p style={{ fontSize: '9px', fontWeight: 700, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {user?.role}
            </p>
          </div>
        </NavLink>

        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
            background: 'none', border: 'none', color: '#5a5248',
            fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,96,96,0.07)'; e.currentTarget.style.color = '#e06060'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#5a5248'; }}
        >
          <LogOut size={15} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop fixed sidebar */}
      <div className="lg:block hidden" style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: '240px', zIndex: 60 }}>
        {renderSidebarContent()}
      </div>

      {/* Mobile header bar */}
      <div className="lg:hidden" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '56px',
        background: '#0e0d0a', borderBottom: '1px solid #1a1610',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', zIndex: 60,
      }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '24px', fontWeight: 700, color: '#c9a84c' }}>LeaveFlow</h1>
        <button onClick={() => setMobileOpen(!mobileOpen)} style={{ background: 'none', border: 'none', color: '#9a9080', cursor: 'pointer', padding: '4px' }}>
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="lg:hidden"
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 58 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile slide-out */}
      <div
        className="lg:hidden"
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, width: '240px', zIndex: 59,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {renderSidebarContent()}
      </div>
    </>
  );
}
