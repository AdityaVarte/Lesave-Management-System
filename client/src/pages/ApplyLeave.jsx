import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Calendar as CalendarIcon, FileText, Loader2, CheckCircle2
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { applyLeave } from '../api/leaveApi';
import { getAllEmployees } from '../api/employeeApi';
import BalancePreview from '../components/BalancePreview';
import { todayInputDate } from '../utils/dateFormat';

const schema = z.object({
  employee_id: z.string().optional(),
  leave_type_id: z.string().min(1, 'Please select a leave type'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  is_half_day: z.boolean().default(false),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

const leaveTypes = [
  { id: '6630f9a234f9a234f9a23401', name: 'Casual', color: '#E4B84D' },
  { id: '6630f9a234f9a234f9a23402', name: 'Sick',   color: '#E07070' },
  { id: '6630f9a234f9a234f9a23403', name: 'Paid',   color: '#70C090' },
];

const labelStyle = {
  display: 'block', fontSize: '10px', fontWeight: 700,
  color: '#5a5248', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px',
};
const errStyle = { fontSize: '10px', color: '#e06060', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px' };

export default function ApplyLeave() {
  const { user, addToast } = useAppStore();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { is_half_day: false, start_date: todayInputDate(), end_date: todayInputDate() },
  });

  const watchedFields = useWatch({ control });
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    const init = async () => {
      if (isAdmin) {
        try { const r = await getAllEmployees(); setEmployees(r.data); }
        catch { addToast('Failed to load employees', 'error'); }
      }
      setInitialLoading(false);
    };
    init();
  }, [isAdmin, addToast]);

  const onSubmit = async (data) => {
    setLoading(true);
    try { await applyLeave(data); addToast('Leave submitted successfully', 'success'); navigate('/my-leaves'); }
    catch (err) { addToast(err.response?.data?.message || 'Failed to submit request', 'error'); }
    finally { setLoading(false); }
  };

  if (initialLoading) return null;

  return (
    <div className="fade-in" style={{ padding: '36px', maxWidth: '760px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '42px', fontWeight: 700, color: '#f5f0e8', lineHeight: 1.1 }}>
          Apply for Leave
        </h2>
        <p style={{ fontSize: '13px', color: '#9a9080', marginTop: '6px' }}>
          Submit your request for review
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card card-gold-top" style={{ padding: '32px' }}>

          {/* Admin: Employee selector */}
          {isAdmin && (
            <div style={{ marginBottom: '28px' }}>
              <label style={labelStyle}>Select Employee</label>
              <select {...register('employee_id')}>
                <option value="">Select an employee...</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.name} ({emp.department})</option>
                ))}
              </select>
              {errors.employee_id && <p style={errStyle}>{errors.employee_id.message}</p>}
            </div>
          )}

          {/* Leave type */}
          <div style={{ marginBottom: '28px' }}>
            <label style={labelStyle}>Leave Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {leaveTypes.map((type) => (
                <label key={type.name} style={{ position: 'relative', cursor: 'pointer' }}>
                  <input type="radio" {...register('leave_type_id')} value={type.id} className="peer sr-only" />
                  <div style={{
                    padding: '14px 16px', borderRadius: '10px',
                    border: '1px solid #231e12',
                    background: '#1c1810',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    transition: 'border-color 0.15s, background 0.15s',
                    cursor: 'pointer',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#c9a84c80'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#231e12'; }}
                  >
                    <div style={{ width: '4px', height: '22px', borderRadius: '4px', background: type.color, flexShrink: 0 }} />
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#f5f0e8' }}>{type.name}</span>
                  </div>
                  {/* Checkmark overlay (shown via CSS) */}
                  <CheckCircle2
                    size={15}
                    style={{ position: 'absolute', top: '10px', right: '10px', color: '#c9a84c', opacity: 0 }}
                    className="peer-checked-show"
                  />
                </label>
              ))}
            </div>
            {errors.leave_type_id && <p style={errStyle}>{errors.leave_type_id.message}</p>}
          </div>

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CalendarIcon size={12} /> Start Date
              </label>
              <input type="date" {...register('start_date')} min={todayInputDate()} />
              {errors.start_date && <p style={errStyle}>{errors.start_date.message}</p>}
            </div>
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CalendarIcon size={12} /> End Date
              </label>
              <input type="date" {...register('end_date')} disabled={watchedFields.is_half_day} min={watchedFields.start_date} />
              {errors.end_date && <p style={errStyle}>{errors.end_date.message}</p>}
            </div>
          </div>

          {/* Half day toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 16px', marginBottom: '24px',
            background: '#1c1810', border: '1px solid #231e12', borderRadius: '10px',
          }}>
            <input
              type="checkbox" {...register('is_half_day')}
              id="half-day"
              className="toggle"
              style={{ width: '40px', height: '22px' }}
              onChange={(e) => {
                const checked = e.target.checked;
                setValue('is_half_day', checked);
                if (checked) setValue('end_date', watchedFields.start_date);
              }}
            />
            <label htmlFor="half-day" style={{ fontSize: '13.5px', fontWeight: 500, color: '#f5f0e8', cursor: 'pointer', userSelect: 'none' }}>
              Apply as Half Day <span style={{ color: '#9a9080', fontSize: '12px' }}>(First Half)</span>
            </label>
          </div>

          {/* Reason */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <FileText size={12} /> Reason for Leave
            </label>
            <textarea
              {...register('reason')}
              rows={4}
              style={{ resize: 'none' }}
              placeholder="Please provide a detailed reason (minimum 10 characters)..."
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '5px' }}>
              {errors.reason
                ? <p style={errStyle}>{errors.reason.message}</p>
                : <p style={{ fontSize: '10px', color: '#5a5248', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Minimum 10 characters required</p>
              }
              <span style={{ fontSize: '11px', fontWeight: 700, color: (watchedFields.reason?.length || 0) >= 10 ? '#5cbf8a' : '#5a5248' }}>
                {watchedFields.reason?.length || 0} characters
              </span>
            </div>
          </div>

          {/* Balance Preview */}
          <div style={{ paddingTop: '20px', borderTop: '1px solid #1a1610', marginBottom: '24px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#c9a84c', textTransform: 'uppercase', letterSpacing: '0.18em', textAlign: 'center', marginBottom: '12px' }}>
              Live Balance Preview
            </p>
            <BalancePreview
              startDate={watchedFields.start_date}
              endDate={watchedFields.is_half_day ? watchedFields.start_date : watchedFields.end_date}
              isHalfDay={watchedFields.is_half_day}
              totalLeaves={user.total_leaves || 20}
              usedLeaves={0}
              pendingLeaves={0}
            />
          </div>

          {/* Submit */}
          <button
            disabled={loading}
            className="btn-gold"
            style={{ width: '100%', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '16px' }}
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : (
              <><CheckCircle2 size={20} /> Submit Application</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
