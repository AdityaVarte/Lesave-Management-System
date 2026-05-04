import React, { useEffect, useState } from 'react';
import {
  Users, UserPlus, Search, Building2, ShieldCheck, Pencil, Trash2, Loader2, Mail
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppStore } from '../store/useAppStore';
import {
  getAllEmployees, createEmployee, updateEmployee, deleteEmployee
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

const labelStyle = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  color: '#5a5248', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px',
};
const errStyle = { fontSize: '10px', color: '#e06060', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const { addToast } = useAppStore();
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { role: 'employee', total_leaves: 20 }
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const r = await getAllEmployees();
      setEmployees(r.data);
    } catch {
      addToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const openPanel = (emp = null) => {
    setEditingEmp(emp);
    if (emp) {
      reset({
        name: emp.name, email: emp.email, department: emp.department,
        role: emp.role, total_leaves: emp.total_leaves, password: '',
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
        const r = await updateEmployee(editingEmp._id, data);
        setEmployees(employees.map(e => e._id === editingEmp._id ? { ...e, ...r.data } : e));
        addToast('Employee updated successfully', 'success');
      } else {
        if (!data.password) return addToast('Password is required', 'warning');
        const r = await createEmployee(data);
        setEmployees([r.data, ...employees]);
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
    <div className="fade-in" style={{ padding: '36px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '32px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '38px', fontWeight: 700, color: '#f5f0e8', lineHeight: 1 }}>Employee Management</h2>
          <p style={{ color: '#9a9080', fontSize: '13px', marginTop: '6px' }}>Manage system users and their leave allocations</p>
        </div>
        <button onClick={() => openPanel()} className="btn-gold" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px' }}>
          <UserPlus size={18} /> Add Employee
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', maxWidth: '440px', marginBottom: '24px' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#5a5248' }} />
        <input
          type="text"
          placeholder="Search by name, email or department..."
          style={{ paddingLeft: '40px', height: '44px' }}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table Card */}
      <div className="card" style={{ overflow: 'hidden' }}>
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
                <tr key={i}><td colSpan={5} style={{ padding: '24px' }}><div className="skeleton" style={{ height: '32px', width: '100%', borderRadius: '8px' }} /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: '60px', textAlign: 'center', color: '#5a5248' }}>No employees found matching your search.</td></tr>
            ) : filtered.map((emp) => (
              <tr key={emp._id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '38px', height: '38px', borderRadius: '50%',
                      background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#c9a84c', fontWeight: 700, fontSize: '13px', fontFamily: "'Cormorant Garamond', serif"
                    }}>
                      {emp.name.charAt(0)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f5f0e8', fontSize: '14px' }}>{emp.name}</div>
                      <div style={{ fontSize: '11px', color: '#5a5248', marginTop: '1px' }}>{emp.email}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#9a9080', fontSize: '13px' }}>
                    <Building2 size={13} color="#c9a84c80" /> {emp.department}
                  </div>
                </td>
                <td>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '3px 10px', borderRadius: '6px',
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    background: emp.role === 'admin' ? 'rgba(201,168,76,0.1)' : '#1c1810',
                    color: emp.role === 'admin' ? '#c9a84c' : '#9a9080',
                    border: emp.role === 'admin' ? '1px solid rgba(201,168,76,0.2)' : '1px solid #231e12'
                  }}>
                    {emp.role === 'admin' && <ShieldCheck size={11} />} {emp.role}
                  </div>
                </td>
                <td style={{ minWidth: '180px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
                    <span style={{ color: '#5a5248' }}>Used: <span style={{ color: '#f5f0e8' }}>{emp.balance?.used || 0}d</span></span>
                    <span style={{ color: '#c9a84c' }}>Rem: {emp.balance?.remaining || 0}d</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: '#1c1810', borderRadius: '10px', overflow: 'hidden', border: '1px solid #231e12' }}>
                    <div style={{
                      height: '100%', background: '#c9a84c', borderRadius: '10px',
                      width: `${Math.min(((emp.balance?.used || 0) / (emp.total_leaves || 20)) * 100, 100)}%`,
                      boxShadow: '0 0 10px rgba(201,168,76,0.4)', transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)'
                    }} />
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={() => openPanel(emp)} className="btn-ghost" style={{ padding: '8px' }} title="Edit Employee"><Pencil size={16} /></button>
                    <button onClick={() => setDeleteId(emp._id)} className="btn-ghost" style={{ padding: '8px', color: '#5a5248' }} title="Delete Employee" onMouseEnter={e => e.currentTarget.style.color = '#e06060'} onMouseLeave={e => e.currentTarget.style.color = '#5a5248'}><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Slide Panel */}
      <SlidePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} title={editingEmp ? 'Edit Employee Details' : 'Onboard New Employee'}>
        <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Full Name</label>
            <input {...register('name')} placeholder="e.g. John Doe" />
            {errors.name && <p style={errStyle}>{errors.name.message}</p>}
          </div>

          <div>
            <label style={labelStyle}>Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#5a5248' }} />
              <input {...register('email')} style={{ paddingLeft: '36px' }} placeholder="john@company.com" />
            </div>
            {errors.email && <p style={errStyle}>{errors.email.message}</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Department</label>
              <select {...register('department')}>
                {['Engineering', 'Design', 'Finance', 'HR', 'Marketing', 'Operations'].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select {...register('role')}>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Total Annual Leaves</label>
            <input type="number" {...register('total_leaves', { valueAsNumber: true })} min={1} max={60} />
          </div>

          <div>
            <label style={labelStyle}>{editingEmp ? 'New Password (Optional)' : 'Initial Password'}</label>
            <input type="password" {...register('password')} placeholder="••••••••" />
            <p style={{ fontSize: '9px', color: '#5a5248', fontStyle: 'italic', marginTop: '4px' }}>Minimum 6 characters required.</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingTop: '20px', borderTop: '1px solid #1a1610' }}>
            <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setPanelOpen(false)}>Cancel</button>
            <button type="submit" className="btn-gold" style={{ flex: 1 }} disabled={submitLoading}>
              {submitLoading ? <Loader2 className="animate-spin" size={18} /> : editingEmp ? 'Save Changes' : 'Create Account'}
            </button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog
        isOpen={!!deleteId}
        title="Delete Employee"
        message="Are you sure you want to remove this employee? This will permanently delete their account and history."
        confirmText="Yes, Delete"
        danger={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
