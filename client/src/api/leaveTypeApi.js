import axiosInstance from './axiosInstance';

export const getLeaveTypes = () => axiosInstance.get('/leave-types');
export const createLeaveType = (data) => axiosInstance.post('/leave-types', data);
export const updateLeaveType = (id, data) => axiosInstance.put(`/leave-types/${id}`, data);
export const deleteLeaveType = (id) => axiosInstance.delete(`/leave-types/${id}`);
