import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  // ─── Auth ─────────────────────────────────────────────────────────────────
  user: JSON.parse(localStorage.getItem('lf_user') || 'null'),
  token: localStorage.getItem('lf_token') || null,
  isAuthenticated: !!localStorage.getItem('lf_token'),

  setAuth: (token, user) => {
    localStorage.setItem('lf_token', token);
    localStorage.setItem('lf_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('lf_token');
    localStorage.removeItem('lf_user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  // ─── Toasts ───────────────────────────────────────────────────────────────
  toasts: [],

  addToast: (message, type = 'success') => {
    const id = Date.now();
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  // ─── Pending Count (for sidebar badge) ───────────────────────────────────
  pendingCount: 0,
  setPendingCount: (count) => set({ pendingCount: count }),
}));
