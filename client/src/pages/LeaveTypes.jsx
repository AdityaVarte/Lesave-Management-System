import React, { useEffect, useState } from 'react';
import { 
  Settings2, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Palette,
  CalendarDays
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppStore } from '../store/useAppStore';
import { 
  getLeaveTypes, 
  createLeaveType, 
  updateLeaveType, 
  deleteLeaveType 
} from '../api/leaveTypeApi';
import SlidePanel from '../components/SlidePanel';
import ConfirmDialog from '../components/ConfirmDialog';

const schema = z.object({
  type_name: z.string().min(2, 'Name is required'),
  max_days_per_request: z.number().min(1).max(60).default(10),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Invalid hex color'),
});

const PRESET_COLORS = [
  '#E4B84D', // Gold
  '#E07070', // Red
  '#70C090', // Green
  '#7090C0', // Blue
  '#C070C0', // Purple
  '#C09070', // Orange
];

export default function LeaveTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  const { addToast } = useAppStore();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { max_days_per_request: 10, color: '#E4B84D' }
  });

  const selectedColor = watch('color');

  const fetchTypes = async () => {
    setLoading(true);
    try {
      const response = await getLeaveTypes();
      setTypes(response.data);
    } catch (err) {
      addToast('Failed to load leave types', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTypes();
  }, []);

  const openPanel = (type = null) => {
    setEditingType(type);
    if (type) {
      reset({
        type_name: type.type_name,
        max_days_per_request: type.max_days_per_request,
        color: type.color,
      });
    } else {
      reset({ max_days_per_request: 10, color: '#E4B84D' });
    }
    setPanelOpen(true);
  };

  const onSubmit = async (data) => {
    setSubmitLoading(true);
    try {
      if (editingType) {
        const response = await updateLeaveType(editingType._id, data);
        setTypes(types.map(t => t._id === editingType._id ? response.data : t));
        addToast('Leave type updated', 'success');
      } else {
        const response = await createLeaveType(data);
        setTypes([...types, response.data]);
        addToast('Leave type created', 'success');
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
      await deleteLeaveType(deleteId);
      setTypes(types.filter(t => t._id !== deleteId));
      addToast('Leave type removed', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Deletion failed', 'error');
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="p-8 space-y-8 fade-in">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-4xl font-bold text-ink-primary">Leave Policy</h2>
          <p className="text-ink-muted text-sm mt-1">Configure available leave categories and restrictions</p>
        </div>
        <button 
          onClick={() => openPanel()}
          className="btn-gold flex items-center gap-2 px-6"
        >
          <Plus size={18} /> New Category
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-6 h-48 skeleton" />
          ))
        ) : types.map((type) => (
          <div key={type._id} className="card p-6 group hover:glow-gold transition-all">
            <div className="flex justify-between items-start mb-6">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center text-primary-card shadow-lg"
                style={{ backgroundColor: type.color }}
              >
                <CalendarDays size={24} />
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => openPanel(type)}
                  className="p-2 text-ink-hint hover:text-gold hover:bg-gold-dim/10 rounded-lg"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  onClick={() => setDeleteId(type._id)}
                  className="p-2 text-ink-hint hover:text-rejected hover:bg-rejected/10 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-ink-primary mb-1">{type.type_name} Leave</h3>
            <div className="flex items-center gap-2 text-ink-muted text-sm">
              <Settings2 size={14} className="text-gold/60" />
              <span>Max {type.max_days_per_request} days per request</span>
            </div>

            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="h-1.5 w-full bg-primary-surface rounded-full overflow-hidden">
                <div 
                  className="h-full opacity-60" 
                  style={{ backgroundColor: type.color, width: '100%' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <SlidePanel 
        isOpen={panelOpen} 
        onClose={() => setPanelOpen(false)} 
        title={editingType ? 'Edit Leave Category' : 'New Leave Category'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Category Name</label>
              <input {...register('type_name')} placeholder="e.g. Sabbatical, Bereavement" />
              {errors.type_name && <p className="text-rejected text-[10px] font-bold uppercase">{errors.type_name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Max Days Per Request</label>
              <input 
                type="number" 
                {...register('max_days_per_request', { valueAsNumber: true })} 
              />
              {errors.max_days_per_request && <p className="text-rejected text-[10px] font-bold uppercase">{errors.max_days_per_request.message}</p>}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Visual Color Tag</label>
              <div className="flex flex-wrap gap-3">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue('color', c)}
                    className={`
                      w-10 h-10 rounded-full border-2 transition-all
                      ${selectedColor === c ? 'border-gold scale-110 shadow-lg' : 'border-transparent hover:scale-105'}
                    `}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-border flex items-center justify-center">
                  <Palette size={16} className="text-ink-hint absolute pointer-events-none" />
                  <input 
                    type="color" 
                    {...register('color')}
                    className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-primary-surface rounded-xl border border-border">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedColor }} />
                <span className="text-xs font-mono text-ink-primary">{selectedColor}</span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border flex gap-3">
            <button type="button" className="btn-ghost flex-1" onClick={() => setPanelOpen(false)}>Cancel</button>
            <button type="submit" className="btn-gold flex-1" disabled={submitLoading}>
              {submitLoading ? <Loader2 className="animate-spin" /> : editingType ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </SlidePanel>

      <ConfirmDialog 
        isOpen={!!deleteId}
        title="Delete Category"
        message="Are you sure? Existing leave requests of this type will still reference this name but may lose visual formatting."
        confirmText="Delete Policy"
        danger={true}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
