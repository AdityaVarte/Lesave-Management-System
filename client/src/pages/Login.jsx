import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { login as loginApi } from '../api/authApi';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAppStore((s) => s.setAuth);
  const addToast = useAppStore((s) => s.addToast);
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  });

  const onSubmit = async (data) => {
    setLoading(true);
    setError('');
    try {
      const response = await loginApi(data);
      setAuth(response.data.token, response.data.user);
      addToast('Welcome back, ' + response.data.user.name, 'success');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
      addToast(err.response?.data?.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-[400px] z-10">
        <div className="text-center mb-10">
          <h1 className="font-display text-6xl font-bold text-gold tracking-tight mb-2">LeaveFlow</h1>
          <p className="text-ink-muted text-sm tracking-widest uppercase">Workforce Leave Intelligence</p>
        </div>

        <div className="card p-8 glow-gold">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-rejected/10 border border-rejected/20 p-3 rounded-lg text-rejected text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-ink-hint uppercase tracking-widest">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-hint" size={18} />
                <input
                  {...register('email')}
                  type="email"
                  placeholder="admin@company.com"
                  className="pl-10"
                />
              </div>
              {errors.email && <p className="text-rejected text-[10px] mt-1 uppercase font-bold">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-ink-hint uppercase tracking-widest">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-hint" size={18} />
                <input
                  {...register('password')}
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                />
              </div>
              {errors.password && <p className="text-rejected text-[10px] mt-1 uppercase font-bold">{errors.password.message}</p>}
            </div>

            <button
              disabled={loading}
              className="btn-gold w-full flex items-center justify-center gap-2 group h-12"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : (
                <>
                  Sign In <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-border space-y-4">
            <p className="text-[10px] text-ink-hint font-bold uppercase tracking-widest text-center">Demo Credentials</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-primary-surface/50 p-3 rounded-xl border border-border flex flex-col items-center">
                <p className="text-[10px] text-gold font-bold uppercase mb-1">Admin</p>
                <p className="text-[11px] text-ink-primary font-medium">admin@company.com</p>
                <p className="text-[10px] text-ink-hint font-mono mt-1">admin123</p>
              </div>
              <div className="bg-primary-surface/50 p-3 rounded-xl border border-border flex flex-col items-center">
                <p className="text-[10px] text-gold font-bold uppercase mb-1">Employee</p>
                <p className="text-[11px] text-ink-primary font-medium">rohan@company.com</p>
                <p className="text-[10px] text-ink-hint font-mono mt-1">pass123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
