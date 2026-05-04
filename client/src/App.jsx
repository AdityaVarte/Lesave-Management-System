import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Toast from './components/Toast';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ApplyLeave from './pages/ApplyLeave';
import MyLeaves from './pages/MyLeaves';
import LeaveReport from './pages/LeaveReport';
import AdminApproval from './pages/AdminApproval';
import Employees from './pages/Employees';
import LeaveTypes from './pages/LeaveTypes';
import Profile from './pages/Profile';

// Route Guard for Authenticated Users
const AuthGuard = ({ children }) => {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

// Route Guard for Admin only
const AdminGuard = ({ children }) => {
  const user = useAppStore((s) => s.user);
  const addToast = useAppStore((s) => s.addToast);

  if (user?.role !== 'admin') {
    addToast('Access denied. Admin privileges required.', 'error');
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Layout Component for Protected Routes
const Layout = ({ children }) => {
  const location = useLocation();

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0c0b08' }}>
      <Sidebar />
      {/* Topbar only on large screens (sidebar visible) */}
      <div className="hidden lg:block">
        <Topbar />
      </div>
      <main
        style={{
          flex: 1,
          marginLeft: 'calc(var(--sidebar-width) * var(--is-lg))',
          paddingTop: 'calc(var(--topbar-height) * var(--is-lg) + 56px * (1 - var(--is-lg)))',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        <div key={location.pathname} className="fade-in">
          {children}
        </div>
      </main>
      <Toast />
    </div>
  );
};

export default function App() {
  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={<Login />} />

      {/* Protected Routes */}
      <Route path="/" element={<AuthGuard><Layout><Dashboard /></Layout></AuthGuard>} />
      <Route path="/dashboard" element={<AuthGuard><Layout><Dashboard /></Layout></AuthGuard>} />
      <Route path="/apply-leave" element={<AuthGuard><Layout><ApplyLeave /></Layout></AuthGuard>} />
      <Route path="/my-leaves" element={<AuthGuard><Layout><MyLeaves /></Layout></AuthGuard>} />
      <Route path="/leave-report" element={<AuthGuard><Layout><LeaveReport /></Layout></AuthGuard>} />
      <Route path="/profile" element={<AuthGuard><Layout><Profile /></Layout></AuthGuard>} />

      {/* Admin Protected Routes */}
      <Route path="/admin/approvals" element={
        <AuthGuard>
          <AdminGuard>
            <Layout><AdminApproval /></Layout>
          </AdminGuard>
        </AuthGuard>
      } />
      <Route path="/admin/employees" element={
        <AuthGuard>
          <AdminGuard>
            <Layout><Employees /></Layout>
          </AdminGuard>
        </AuthGuard>
      } />
      <Route path="/admin/leave-types" element={
        <AuthGuard>
          <AdminGuard>
            <Layout><LeaveTypes /></Layout>
          </AdminGuard>
        </AuthGuard>
      } />

      {/* 404 Redirect */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
