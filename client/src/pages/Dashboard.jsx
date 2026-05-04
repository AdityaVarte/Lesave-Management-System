import React, { useEffect, useState } from 'react';
import {
  Users, Clock, CheckCircle2, BarChart3, Calendar, ArrowUpRight, TrendingUp, PieChart as PieIcon, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { getDashboard, getAdminDashboard } from '../api/analyticsApi';
import MetricCard from '../components/MetricCard';
import LeaveTable from '../components/LeaveTable';
import { Link } from 'react-router-dom';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#141209', border: '1px solid #c9a84c30', padding: '10px 14px', borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#5a5248', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>{label}</p>
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#c9a84c' }}>{`${payload[0].value} ${payload[0].name || 'Requests'}`}</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user, addToast } = useAppStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = user.role === 'admin'
          ? await getAdminDashboard()
          : await getDashboard();
        setData(response.data);
      } catch (err) {
        addToast('Failed to load dashboard data', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.role]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid rgba(201,168,76,0.1)', borderTopColor: '#c9a84c', borderRadius: '50%' }} />
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="fade-in" style={{ padding: '36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '42px', fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>Dashboard</h2>
          <p style={{ color: '#9a9080', fontSize: '13px', marginTop: '8px' }}>
            Welcome back, <span style={{ color: '#c9a84c', fontWeight: 600 }}>{user.name}</span>
          </p>
        </div>
        {!isAdmin && (
          <Link to="/apply-leave" className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', textDecoration: 'none' }}>
            <Calendar size={18} /> Apply for Leave
          </Link>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px', marginBottom: '32px' }}>
        {isAdmin ? (
          <>
            <MetricCard title="Total Employees" value={data.totalEmployees} icon={Users} color="#C9A84C" />
            <MetricCard
              title="Pending Approvals"
              value={data.pendingCount}
              icon={Clock}
              color={data.pendingCount > 0 ? '#E4B84D' : '#9A9080'}
              glowColor={data.pendingCount > 0 ? 'rgba(228, 184, 77, 0.2)' : undefined}
            />
            <MetricCard title="Approved This Month" value={data.approvedThisMonth} icon={CheckCircle2} color="#5CBF8A" />
            <MetricCard title="Avg Balance" value={`${data.avgBalance}d`} icon={BarChart3} color="#F0C060" />
          </>
        ) : (
          <>
            <MetricCard title="Total Allocated" value={`${data.balance.total}d`} icon={Calendar} color="#9A9080" />
            <MetricCard title="Used Leaves" value={`${data.balance.used}d`} icon={CheckCircle2} color="#5CBF8A" />
            <MetricCard title="Pending" value={`${data.balance.pending}d`} icon={Clock} color="#E4B84D" />
            <MetricCard
              title="Remaining"
              value={`${data.balance.remaining}d`}
              icon={TrendingUp}
              color={data.balance.remaining < 2 ? '#E06060' : data.balance.remaining < 5 ? '#E4B84D' : '#5CBF8A'}
            />
          </>
        )}
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Chart 1: Bar Chart */}
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            <BarChart3 size={17} color="#c9a84c" />
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#f5f0e8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              {isAdmin ? 'Department Breakdown' : 'Leave Usage by Type'}
            </h3>
          </div>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={isAdmin ? data.departmentStats : data.typeBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#231e12" vertical={false} />
                <XAxis dataKey={isAdmin ? "_id" : "type_name"} stroke="#5a5248" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#5a5248" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(201,168,76,0.05)' }} />
                <Bar dataKey={isAdmin ? "count" : "days"} fill="#c9a84c" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Area or Pie */}
        <div className="card" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
            {isAdmin ? <TrendingUp size={17} color="#c9a84c" /> : <PieIcon size={17} color="#c9a84c" />}
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#f5f0e8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
              {isAdmin ? 'Monthly Request Trend' : 'Leave Type Distribution'}
            </h3>
          </div>
          <div style={{ height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              {isAdmin ? (
                <AreaChart data={data.monthlyStats}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c9a84c" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#c9a84c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#231e12" vertical={false} />
                  <XAxis dataKey="_id" stroke="#5a5248" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#5a5248" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="count" stroke="#c9a84c" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              ) : (
                <PieChart>
                  <Pie
                    data={data.typeBreakdown}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="days"
                    nameKey="type_name"
                    stroke="none"
                  >
                    {data.typeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#c9a84c'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#141209', border: '1px solid #c9a84c30', borderRadius: '10px', fontSize: '12px', color: '#f5f0e8' }}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Latest Requests Table Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', padding: '0 4px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#f5f0e8', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
            {isAdmin ? 'Latest Pending Requests' : 'Recent Leave Requests'}
          </h3>
          <Link
            to={isAdmin ? "/admin/approvals" : "/my-leaves"}
            style={{ fontSize: '10px', fontWeight: 700, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: '0.12em', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f0c060'}
            onMouseLeave={e => e.currentTarget.style.color = '#c9a84c'}
          >
            View All <ChevronRight size={14} />
          </Link>
        </div>
        <div className="card" style={{ overflow: 'hidden' }}>
          <LeaveTable
            leaves={isAdmin ? data.latestPending : data.recentRequests}
            showEmployee={isAdmin}
          />
        </div>
      </div>
    </div>
  );
}
