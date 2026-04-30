import api from './axiosInstance';

export const getLeaves = (params) => api.get('/leaves', { params });
export const getPendingLeaves = () => api.get('/leaves/pending');
export const getLeave = (id) => api.get(`/leaves/${id}`);
export const applyLeave = (data) => api.post('/leaves', data);
export const approveLeave = (id) => api.put(`/leaves/${id}/approve`);
export const rejectLeave = (id, data) => api.put(`/leaves/${id}/reject`, data);
export const cancelLeave = (id) => api.put(`/leaves/${id}/cancel`);
