import api from './axiosInstance';

export const getDashboard = () => api.get('/analytics/dashboard');
export const getAdminDashboard = () => api.get('/analytics/admin-dashboard');
export const getMonthlyTrend = () => api.get('/analytics/monthly-trend');
export const getDepartmentSummary = () => api.get('/analytics/department-summary');
