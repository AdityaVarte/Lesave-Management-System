import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle2, 
  BarChart3, 
  Calendar,
  ArrowUpRight,
  TrendingUp,
  PieChart as PieIcon
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { useAppStore } from '../store/useAppStore';
import { getDashboard, getAdminDashboard } from '../api/analyticsApi';
import MetricCard from '../components/MetricCard';
import LeaveTable from '../components/LeaveTable';
import { Link } from 'react-router-dom';

const chartTheme = {
  background: 'transparent',
  gridColor: '#2A2418',
  axisColor: '#9A9080',
  tooltipBg: '#1A1814',
  tooltipBorder: '#C9A84C',
  tooltipText: '#F5F0E8',
  barFill: '#C9A84C',
  lineStroke: '#E4B84D',
  lineWidth: 2,
  dotFill: '#F0C060',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-primary-card border border-gold/30 p-3 rounded-lg shadow-xl">
        <p className="text-xs font-bold text-ink-muted uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm font-bold text-gold">{`${payload[0].value} Days`}</p>
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
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="p-8 space-y-8 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-ink-primary">Dashboard</h2>
          <p className="text-ink-muted text-sm mt-1">Welcome back, <span className="text-gold font-medium">{user.name}</span></p>
        </div>
        {!isAdmin && (
          <Link to="/apply-leave" className="btn-gold flex items-center gap-2 w-full sm:w-auto justify-center">
            <Calendar size={18} /> Apply for Leave
          </Link>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-ink-primary uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={16} className="text-gold" />
              {isAdmin ? 'Department Breakdown' : 'Leave History'}
            </h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={isAdmin ? data.topEmployees : data.monthlyHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
                <XAxis 
                  dataKey={isAdmin ? "department" : "_id"} 
                  stroke={chartTheme.axisColor} 
                  fontSize={10} 
                  tickFormatter={(val) => isAdmin ? val : `Month ${val}`}
                />
                <YAxis stroke={chartTheme.axisColor} fontSize={10} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(201,168,76,0.05)' }} />
                <Bar dataKey={isAdmin ? "totalDays" : "days"} fill={chartTheme.barFill} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold text-ink-primary uppercase tracking-widest flex items-center gap-2">
              {isAdmin ? <TrendingUp size={16} className="text-gold" /> : <PieIcon size={16} className="text-gold" />}
              {isAdmin ? 'Monthly Trend' : 'Leave Type Breakdown'}
            </h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {isAdmin ? (
                <LineChart data={data.latestPending}>
                   <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} vertical={false} />
                   <XAxis dataKey="employee_snapshot.name" stroke={chartTheme.axisColor} fontSize={10} />
                   <YAxis stroke={chartTheme.axisColor} fontSize={10} />
                   <Tooltip content={<CustomTooltip />} />
                   <Line type="monotone" dataKey="working_days" stroke={chartTheme.lineStroke} strokeWidth={2} dot={{ fill: chartTheme.dotFill }} />
                </LineChart>
              ) : (
                <PieChart>
                  <Pie
                    data={data.typeBreakdown}
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="days"
                    nameKey="_id"
                  >
                    {data.typeBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ background: '#1A1814', border: '1px solid #2A2418', borderRadius: '8px', fontSize: '12px' }}
                    itemStyle={{ color: '#F5F0E8' }}
                  />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink-primary uppercase tracking-widest">
            {isAdmin ? 'Latest Pending Requests' : 'Recent Leave Requests'}
          </h3>
          <Link 
            to={isAdmin ? "/admin/approvals" : "/my-leaves"} 
            className="text-gold text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:underline"
          >
            View All <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="p-0">
          <LeaveTable 
            leaves={isAdmin ? data.latestPending : data.recentRequests} 
            showEmployee={isAdmin}
          />
        </div>
      </div>
    </div>
  );
}
