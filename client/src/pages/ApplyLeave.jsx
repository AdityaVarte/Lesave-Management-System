import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  FileText, 
  AlertCircle,
  Loader2,
  CheckCircle2
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
  { id: '6630f9a234f9a234f9a23401', name: 'Casual', color: '#E4B84D' }, // Fixed IDs to match seed script (placeholder for now)
  { id: '6630f9a234f9a234f9a23402', name: 'Sick',   color: '#E07070' },
  { id: '6630f9a234f9a234f9a23403', name: 'Paid',   color: '#70C090' },
];

export default function ApplyLeave() {
  const { user, addToast } = useAppStore();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { register, handleSubmit, control, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      is_half_day: false,
      start_date: todayInputDate(),
      end_date: todayInputDate(),
    }
  });

  const watchedFields = useWatch({ control });
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    const init = async () => {
      if (isAdmin) {
        try {
          const response = await getAllEmployees();
          setEmployees(response.data);
        } catch (err) {
          addToast('Failed to load employees', 'error');
        }
      }
      setInitialLoading(false);
    };
    init();
  }, [isAdmin]);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // Find the actual MongoDB IDs for leave types based on the seed
      // In a real app we'd fetch these from /api/leave-types
      // For now we assume the seed IDs or fetch them
      await applyLeave(data);
      addToast('Leave request submitted successfully', 'success');
      navigate('/my-leaves');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to submit request', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return null;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8 fade-in">
      <div className="text-center mb-6">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-ink-primary">Apply for Leave</h2>
        <p className="text-ink-muted text-sm mt-1">Submit your request for review</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card p-8 space-y-8 glow-gold">
          
          {isAdmin && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink-hint uppercase tracking-widest">Select Employee</label>
              <select {...register('employee_id')} className="w-full">
                <option value="">Select an employee...</option>
                {employees.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.name} ({emp.department})</option>
                ))}
              </select>
              {errors.employee_id && <p className="text-rejected text-[10px] uppercase font-bold">{errors.employee_id.message}</p>}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-ink-hint uppercase tracking-widest">Leave Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {leaveTypes.map((type) => (
                <label key={type.name} className="relative cursor-pointer group">
                  <input
                    type="radio"
                    {...register('leave_type_id')}
                    value={type.id}
                    className="peer sr-only"
                  />
                  <div className={`
                    p-4 rounded-xl border border-border bg-primary-surface transition-all
                    peer-checked:border-gold peer-checked:bg-gold-dim/20
                    hover:border-gold/50
                  `}>
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-6 rounded-full" style={{ backgroundColor: type.color }} />
                      <span className="font-bold text-ink-primary">{type.name}</span>
                    </div>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 peer-checked:opacity-100 transition-opacity">
                    <CheckCircle2 size={16} className="text-gold" />
                  </div>
                </label>
              ))}
            </div>
            {errors.leave_type_id && <p className="text-rejected text-[10px] uppercase font-bold">{errors.leave_type_id.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-ink-hint uppercase tracking-widest flex items-center gap-2">
                <CalendarIcon size={14} /> Start Date
              </label>
              <input type="date" {...register('start_date')} min={todayInputDate()} />
              {errors.start_date && <p className="text-rejected text-[10px] uppercase font-bold">{errors.start_date.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-ink-hint uppercase tracking-widest flex items-center gap-2">
                <CalendarIcon size={14} /> End Date
              </label>
              <input 
                type="date" 
                {...register('end_date')} 
                disabled={watchedFields.is_half_day}
                min={watchedFields.start_date} 
              />
              {errors.end_date && <p className="text-rejected text-[10px] uppercase font-bold">{errors.end_date.message}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-primary-surface/50 border border-border rounded-xl">
            <input 
              type="checkbox" 
              {...register('is_half_day')} 
              id="half-day" 
              className="w-5 h-5 accent-gold cursor-pointer"
              onChange={(e) => {
                const checked = e.target.checked;
                setValue('is_half_day', checked);
                if (checked) setValue('end_date', watchedFields.start_date);
              }}
            />
            <label htmlFor="half-day" className="text-sm font-medium text-ink-primary cursor-pointer select-none">
              Apply as Half Day (First Half)
            </label>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-ink-hint uppercase tracking-widest flex items-center gap-2">
              <FileText size={14} /> Reason for Leave
            </label>
            <textarea
              {...register('reason')}
              rows={4}
              placeholder="Please provide a detailed reason (minimum 10 characters)..."
              className="resize-none"
            />
            <div className="flex justify-between items-center mt-1">
              {errors.reason ? (
                <p className="text-rejected text-[10px] uppercase font-bold">{errors.reason.message}</p>
              ) : (
                <p className="text-[10px] text-ink-hint uppercase font-bold">Minimum 10 characters required</p>
              )}
              <span className={`text-[10px] font-bold ${(watchedFields.reason?.length || 0) >= 10 ? 'text-status-approved' : 'text-ink-hint'}`}>
                {watchedFields.reason?.length || 0} characters
              </span>
            </div>
          </div>

          <div className="pt-6 border-t border-border/50">
            <p className="text-[10px] font-bold text-gold uppercase tracking-[0.2em] mb-4 text-center">Live Balance Preview</p>
            <BalancePreview
              startDate={watchedFields.start_date}
              endDate={watchedFields.is_half_day ? watchedFields.start_date : watchedFields.end_date}
              isHalfDay={watchedFields.is_half_day}
              totalLeaves={user.total_leaves || 20}
              usedLeaves={0} // These would normally come from the user's current stats
              pendingLeaves={0}
            />
          </div>

          <button
            disabled={loading}
            className="btn-gold w-full h-14 flex items-center justify-center gap-3 text-lg"
          >
            {loading ? <Loader2 className="animate-spin" /> : (
              <>
                <CheckCircle2 size={20} /> Submit Application
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
