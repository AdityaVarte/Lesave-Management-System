import React, { useState } from 'react';
import {
  User, Mail, Lock, Shield, Building2, Save, KeyRound, Loader2, CalendarCheck
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppStore } from '../store/useAppStore';
import { updateProfile, changePassword } from '../api/profileApi';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords don't match", path: ['confirmPassword'],
});

/* ── Shared label style ──────────────────────────────── */
const labelStyle = {
  display: 'block',
  fontSize: '10px', fontWeight: 700,
  color: '#5a5248',
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  marginBottom: '6px',
};
const errStyle = { fontSize: '10px', color: '#e06060', fontWeight: 700, textTransform: 'uppercase', marginTop: '4px' };

export default function Profile() {
  const { user, setUser, addToast } = useAppStore();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const pf = useForm({ resolver: zodResolver(profileSchema), defaultValues: { name: user?.name || '', email: user?.email || '' } });
  const pwf = useForm({ resolver: zodResolver(passwordSchema) });

  const onProfileSubmit = async (data) => {
    setProfileLoading(true);
    try { const r = await updateProfile(data); setUser(r.data); addToast('Profile updated', 'success'); }
    catch (err) { addToast(err.response?.data?.message || 'Failed to update profile', 'error'); }
    finally { setProfileLoading(false); }
  };

  const onPasswordSubmit = async (data) => {
    setPasswordLoading(true);
    try { await changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword }); addToast('Password changed', 'success'); pwf.reset(); }
    catch (err) { addToast(err.response?.data?.message || 'Failed to change password', 'error'); }
    finally { setPasswordLoading(false); }
  };

  return (
    <div className="fade-in" style={{ padding: '36px', maxWidth: '1200px' }}>
      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '38px', fontWeight: 700, color: '#f5f0e8', lineHeight: 1.1 }}>
          Account Settings
        </h2>
        <p style={{ fontSize: '13px', color: '#9a9080', marginTop: '4px' }}>
          Manage your profile and security preferences
        </p>
      </div>

      {/* 3-col grid: 1 left info card + 2 right forms */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px', alignItems: 'start' }}>

        {/* ── Left: Profile Card ── */}
        <div className="card card-gold-top" style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          {/* Avatar */}
          <div style={{
            width: '88px', height: '88px', borderRadius: '50%',
            background: 'rgba(201,168,76,0.1)',
            border: '2px solid rgba(201,168,76,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '40px', fontWeight: 700, color: '#c9a84c',
            boxShadow: '0 0 30px rgba(201,168,76,0.12)',
          }}>
            {user?.name?.charAt(0)}
          </div>

          {/* Name & email */}
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#f5f0e8', marginBottom: '2px' }}>{user?.name}</h3>
            <p style={{ fontSize: '12px', color: '#9a9080' }}>{user?.email}</p>
          </div>

          {/* Info rows */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
            {[
              { icon: Building2,    label: 'Department',        value: user?.department },
              { icon: Shield,       label: 'Access Level',      value: user?.role?.toUpperCase() },
              { icon: CalendarCheck,label: 'Annual Leave Quota',value: `${user?.total_leaves} Days` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 12px', borderRadius: '8px',
                background: '#1c1810', border: '1px solid #231e12',
              }}>
                <Icon size={16} color="#c9a84c" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '9px', fontWeight: 700, color: '#5a5248', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</p>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: '#f5f0e8', marginTop: '1px' }}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Forms ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Personal Info */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #1a1610' }}>
              <User size={17} color="#c9a84c" />
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#f5f0e8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Personal Information
              </h3>
            </div>
            <form onSubmit={pf.handleSubmit(onProfileSubmit)}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input {...pf.register('name')} placeholder="Your name" />
                  {pf.formState.errors.name && <p style={errStyle}>{pf.formState.errors.name.message}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#5a5248' }} />
                    <input {...pf.register('email')} style={{ paddingLeft: '36px' }} placeholder="your@email.com" />
                  </div>
                  {pf.formState.errors.email && <p style={errStyle}>{pf.formState.errors.email.message}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-gold" disabled={profileLoading} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {profileLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Security */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #1a1610' }}>
              <Lock size={17} color="#c9a84c" />
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#f5f0e8', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                Security &amp; Password
              </h3>
            </div>
            <form onSubmit={pwf.handleSubmit(onPasswordSubmit)}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Current Password</label>
                <div style={{ position: 'relative', maxWidth: '380px' }}>
                  <KeyRound size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#5a5248' }} />
                  <input type="password" {...pwf.register('currentPassword')} style={{ paddingLeft: '36px' }} placeholder="••••••••" />
                </div>
                {pwf.formState.errors.currentPassword && <p style={errStyle}>{pwf.formState.errors.currentPassword.message}</p>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <label style={labelStyle}>New Password</label>
                  <input type="password" {...pwf.register('newPassword')} placeholder="••••••••" />
                  {pwf.formState.errors.newPassword && <p style={errStyle}>{pwf.formState.errors.newPassword.message}</p>}
                </div>
                <div>
                  <label style={labelStyle}>Confirm New Password</label>
                  <input type="password" {...pwf.register('confirmPassword')} placeholder="••••••••" />
                  {pwf.formState.errors.confirmPassword && <p style={errStyle}>{pwf.formState.errors.confirmPassword.message}</p>}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-gold" disabled={passwordLoading} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {passwordLoading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
