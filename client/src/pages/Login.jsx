import { useState } from 'react';
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
    <div style={{ minHeight: '100vh', background: '#0c0b08', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', position: 'relative' }}>
      {/* Decorative glow orbs */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: '45%', height: '45%', background: 'radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)', filter: 'blur(60px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: '45%', height: '45%', background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)', filter: 'blur(60px)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '60%', height: '60%', background: 'radial-gradient(circle, rgba(201,168,76,0.02) 0%, transparent 70%)', filter: 'blur(80px)', borderRadius: '50%' }} />
      </div>

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '58px', fontWeight: 700, background: 'linear-gradient(135deg, #c9a84c, #f0c060)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.02em', lineHeight: 1, marginBottom: '8px' }}>
            LeaveFlow
          </h1>
          <p style={{ color: '#5a5248', fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600 }}>
            Workforce Leave Intelligence
          </p>
        </div>

        <div className="card card-gold-top" style={{ padding: '32px', boxShadow: '0 0 0 1px #231e12, 0 24px 80px rgba(0,0,0,0.6), 0 0 60px rgba(201,168,76,0.05)' }}>
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
