import React, { useEffect, useState } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  Mail, 
  Building2, 
  ShieldCheck, 
  Pencil, 
  Trash2, 
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppStore } from '../store/useAppStore';
import { 
  getAllEmployees, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee 
} from '../api/employeeApi';
import SlidePanel from '../components/SlidePanel';
import ConfirmDialog from '../components/ConfirmDialog';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  department: z.enum(['Engineering', 'Design', 'Finance', 'HR', 'Marketing', 'Operations']),
  role: z.enum(['employee', 'admin']),
  total_leaves: z.number().min(1).max(60).default(20),
  password: z.string().optional().or(z.literal('')),
});

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { addToast } = useAppStore();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: 'employee', total_leaves: 20 }
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const response = await getAllEmployees();
      setEmployees(response.data);
    } catch (err) {
      addToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const openPanel = (emp = null) => {
    setEditingEmp(emp);
    if (emp) {
      reset({
        name: emp.name,
        email: emp.email,
        department: emp.department,
        role: emp.role,
        total_leaves: emp.total_leaves,
        password: '',
      });
    } else {
      reset({ role: 'employee', total_leaves: 20 });
    }
    setPanelOpen(true);
  };

  const onSubmit = async (data) => {
    setSubmitLoading(true);
    try {
      if (editingEmp) {
        const response = await updateEmployee(editingEmp._id, data);
        setEmployees(employees.map(e => e._id === editingEmp._id ? { ...e, ...response.data } : e));
        addToast('Employee updated successfully', 'success');
      } else {
        if (!data.password) return addToast('Password is required for new employees', 'warning');
        const response = await createEmployee(data);
        setEmployees([response.data, ...employees]);
        addToast('Employee created successfully', 'success');
      }
      setPanelOpen(false);
    } catch (err) {
      addToast(err.response?.data?.message || 'Operation failed', 'error');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteEmployee(deleteId);
      setEmployees(employees.filter(e => e._id !== deleteId));
      addToast('Employee removed successfully', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Deletion failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  const filtered = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 space-y-8 fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl font-bold text-ink-primary">Employee Management</h2>
          <p className="text-ink-muted text-sm mt-1">Manage system users and their leave allocations</p>
        </div>
        <button 
          onClick={() => openPanel()}
          className="btn-gold flex items-center gap-2 px-6"
        >
          <UserPlus size={18} /> Add Employee
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-hint" size={18} />
        <input 
          type="text" 
          placeholder="Search by name, email or department..." 
          className="pl-10 h-11"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="card glow-gold overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Department</th>
              <th>Role</th>
              <th>Leave Balance</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="p-4"><div className="skeleton h-12 w-full" /></td>
                </tr>
              ))
            ) : filtered.map((emp) => (
              <tr key={emp._id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gold-dim/20 border border-gold/20 flex items-center justify-center text-gold font-bold text-xs">
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-ink-primary">{emp.name}</div>
                      <div className="text-[11px] text-ink-hint">{emp.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <Building2 size={12} className="text-gold/60" /> {emp.department}
                  </div>
                </td>
                <td>
                  <div className={`
                    inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                    ${emp.role === 'admin' ? 'bg-gold-dim text-gold border border-gold/20' : 'bg-primary-surface text-ink-muted border border-border'}
                  `}>
                    {emp.role === 'admin' && <ShieldCheck size={10} />} {emp.role}
                  </div>
                </td>
                <td className="w-48">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-ink-hint mb-1.5">
                    <span>Used: {emp.balance?.used || 0}d</span>
                    <span className="text-gold">Rem: {emp.balance?.remaining || 0}d</span>
                  </div>
                  <div className="w-full h-1.5 bg-primary-surface rounded-full overflow-hidden border border-border">
                    <div 
                      className="h-full bg-gold shadow-[0_0_8px_rgba(201,168,76,0.5)] transition-all duration-500" 
                      style={{ width: `${Math.min(((emp.balance?.used || 0) / (emp.total_leaves || 20)) * 100, 100)}%` }} 
                    />
                  </div>
                </td>
                <td>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => openPanel(emp)}
                      className="p-2 text-ink-hint hover:text-gold hover:bg-gold-dim/10 rounded-lg transition-all"
                      title="Edit Employee"
                    >
                      <Pencil size={16} />
                    </button>
                    <button 
                      onClick={() => setDeleteId(emp._id)}
                      className="p-2 text-ink-hint hover:text-rejected hover:bg-rejected/10 rounded-lg transition-all"
                      title="Delete Employee"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slide-in Panel */}
      <SlidePanel 
        isOpen={panelOpen} 
        onClose={() => setPanelOpen(false)} 
        title={editingEmp ? 'Edit Employee Details' : 'Onboard New Employee'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Full Name</label>
              <input {...register('name')} placeholder="e.g. John Doe" />
              {errors.name && <p className="text-rejected text-[10px] uppercase font-bold">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-hint" size={14} />
                <input {...register('email')} className="pl-9" placeholder="john@company.com" />
              </div>
              {errors.email && <p className="text-rejected text-[10px] uppercase font-bold">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Department</label>
                <select {...register('department')}>
                  <option value="Engineering">Engineering</option>
                  <option value="Design">Design</option>
                  <option value="Finance">Finance</option>
                  <option value="HR">HR</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operations">Operations</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Role</label>
                <select {...register('role')}>
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Total Annual Leaves</label>
              <input 
                type="number" 
                {...register('total_leaves', { valueAsNumber: true })} 
                min={1} max={60} 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">
                {editingEmp ? 'New Password (Optional)' : 'Initial Password'}
              </label>
              <input type="password" {...register('password')} placeholder="••••••••" />
              <p className="text-[9px] text-ink-hint italic">Minimum 6 characters required.</p>
            </div>
          </div>

          <div className="pt-6 border-t border-border flex gap-3">
            <button 
              type="button" 
              className="btn-ghost flex-1" 
              onClick={() => setPanelOpen(false)}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn-gold flex-1"
              disabled={submitLoading}
            >
              {submitLoading ? <Loader2 className="animate-spin" /> : editingEmp ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog 
        isOpen={!!deleteId}
        title="Delete Employee"
        message="Are you sure you want to remove this employee? This will permanently delete their account. This action is blocked if the employee has active leave requests."
        confirmText="Yes, Delete"
        danger={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
