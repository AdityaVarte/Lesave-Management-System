import React, { useState } from 'react';
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
  X
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const NavItem = ({ to, icon: Icon, label, badge }) => (
  <NavLink
    to={to}
    className={({ isActive }) => `
      flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative
      ${isActive 
        ? 'bg-gold-dim text-gold' 
        : 'text-ink-muted hover:text-ink-primary hover:bg-primary-surface'}
    `}
  >
    {({ isActive }) => (
      <>
        <Icon size={20} className={isActive ? 'text-gold' : 'text-ink-muted group-hover:text-ink-primary'} />
        <span className="font-medium text-sm">{label}</span>
        {badge > 0 && (
          <span className="ml-auto bg-gold text-primary font-bold text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
            {badge}
          </span>
        )}
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-gold rounded-r-full shadow-[0_0_8px_rgba(201,168,76,0.5)]" />
        )}
      </>
    )}
  </NavLink>
);

export default function Sidebar() {
  const { user, logout, pendingCount } = useAppStore();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-primary-card border-b border-border px-4 flex items-center justify-between z-50">
        <h1 className="font-display text-2xl font-bold text-gold tracking-tight">LeaveFlow</h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-ink-muted hover:text-gold"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Container */}
      <aside className={`
        fixed left-0 top-0 bottom-0 bg-[#111008] border-r border-border flex flex-col z-[60]
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ width: 'var(--sidebar-width)' }}>
        {/* Logo */}
        <div className="p-8">
          <h1 className="font-display text-3xl font-bold text-gold tracking-tight">LeaveFlow</h1>
          <p className="text-[10px] text-ink-hint uppercase tracking-[0.2em] mt-1">Workforce Intelligence</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavItem to="/apply-leave" icon={CalendarPlus} label="Apply Leave" />
          <NavItem to="/my-leaves" icon={ClipboardList} label="My Leaves" />
          <NavItem to="/leave-report" icon={BarChart2} label="Leave Report" />
          <NavItem to="/profile" icon={UserCircle} label="Account Settings" />
          
          {isAdmin && (
            <>
              <div className="my-4 border-t border-border/50 mx-2" />
              <p className="px-4 text-[10px] font-semibold text-ink-hint uppercase tracking-widest mb-2">Administration</p>
              <NavItem to="/admin/approvals" icon={CheckSquare} label="Approvals" badge={pendingCount} />
              <NavItem to="/admin/employees" icon={Users} label="Employees" />
              <NavItem to="/admin/leave-types" icon={Settings2} label="Leave Policies" />
            </>
          )}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 bg-primary-card/50 border-t border-border mt-auto">
          <NavLink 
            to="/profile"
            className="flex items-center gap-3 mb-4 px-2 hover:bg-gold-dim/10 py-2 rounded-xl transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-gold-dim border border-gold/30 flex items-center justify-center text-gold font-bold text-lg shadow-[0_0_15px_rgba(201,168,76,0.1)] group-hover:scale-110 transition-transform">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-primary truncate">{user?.name}</p>
              <p className="text-[10px] font-bold text-gold uppercase tracking-tighter opacity-80">{user?.role}</p>
            </div>
          </NavLink>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-ink-muted hover:text-rejected hover:bg-rejected/5 rounded-lg transition-all group"
          >
            <LogOut size={18} className="group-hover:translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
