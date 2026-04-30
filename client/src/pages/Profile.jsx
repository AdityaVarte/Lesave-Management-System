import React, { useState } from 'react';
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  Building2, 
  Save, 
  KeyRound,
  Loader2,
  CalendarCheck
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
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export default function Profile() {
  const { user, setUser, addToast } = useAppStore();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
    }
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
  });

  const onProfileSubmit = async (data) => {
    setProfileLoading(true);
    try {
      const response = await updateProfile(data);
      setUser(response.data);
      addToast('Profile updated successfully', 'success');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const onPasswordSubmit = async (data) => {
    setPasswordLoading(true);
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      addToast('Password changed successfully', 'success');
      passwordForm.reset();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to change password', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 fade-in">
      <div>
        <h2 className="font-display text-4xl font-bold text-ink-primary">Account Settings</h2>
        <p className="text-ink-muted text-sm mt-1">Manage your profile and security preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Info Summary */}
        <div className="space-y-6">
          <div className="card p-8 text-center flex flex-col items-center glow-gold">
            <div className="w-24 h-24 rounded-full bg-gold-dim border-2 border-gold/30 flex items-center justify-center text-gold font-bold text-4xl mb-4 shadow-[0_0_30px_rgba(201,168,76,0.15)]">
              {user?.name?.charAt(0)}
            </div>
            <h3 className="text-xl font-bold text-ink-primary">{user?.name}</h3>
            <p className="text-sm text-ink-muted mb-6">{user?.email}</p>
            
            <div className="w-full space-y-3">
              <div className="flex items-center gap-3 p-3 bg-primary-surface rounded-xl border border-border">
                <Building2 size={18} className="text-gold" />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-ink-hint uppercase tracking-widest">Department</p>
                  <p className="text-sm font-medium text-ink-primary">{user?.department}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-primary-surface rounded-xl border border-border">
                <Shield size={18} className="text-gold" />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-ink-hint uppercase tracking-widest">Access Level</p>
                  <p className="text-sm font-medium text-ink-primary uppercase tracking-tighter">{user?.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-primary-surface rounded-xl border border-border">
                <CalendarCheck size={18} className="text-gold" />
                <div className="text-left">
                  <p className="text-[10px] font-bold text-ink-hint uppercase tracking-widest">Annual Leave Quota</p>
                  <p className="text-sm font-medium text-ink-primary">{user?.total_leaves} Days</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Forms */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Form */}
          <div className="card p-8">
            <div className="flex items-center gap-2 mb-8">
              <User size={20} className="text-gold" />
              <h3 className="text-lg font-bold text-ink-primary">Personal Information</h3>
            </div>
            
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Full Name</label>
                  <input {...profileForm.register('name')} placeholder="Your name" />
                  {profileForm.formState.errors.name && (
                    <p className="text-rejected text-[10px] font-bold uppercase">{profileForm.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-hint" size={16} />
                    <input {...profileForm.register('email')} className="pl-10" placeholder="your@email.com" />
                  </div>
                  {profileForm.formState.errors.email && (
                    <p className="text-rejected text-[10px] font-bold uppercase">{profileForm.formState.errors.email.message}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit" 
                  className="btn-gold flex items-center gap-2 px-8"
                  disabled={profileLoading}
                >
                  {profileLoading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Password Form */}
          <div className="card p-8">
            <div className="flex items-center gap-2 mb-8">
              <Lock size={20} className="text-gold" />
              <h3 className="text-lg font-bold text-ink-primary">Security & Password</h3>
            </div>
            
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
              <div className="space-y-1.5 max-w-md">
                <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Current Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-hint" size={16} />
                  <input type="password" {...passwordForm.register('currentPassword')} className="pl-10" placeholder="••••••••" />
                </div>
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-rejected text-[10px] font-bold uppercase">{passwordForm.formState.errors.currentPassword.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">New Password</label>
                  <input type="password" {...passwordForm.register('newPassword')} placeholder="••••••••" />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-rejected text-[10px] font-bold uppercase">{passwordForm.formState.errors.newPassword.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-ink-hint uppercase tracking-widest px-1">Confirm New Password</label>
                  <input type="password" {...passwordForm.register('confirmPassword')} placeholder="••••••••" />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-rejected text-[10px] font-bold uppercase">{passwordForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  type="submit" 
                  className="btn-gold flex items-center gap-2 px-8"
                  disabled={passwordLoading}
                >
                  {passwordLoading ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} />}
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
