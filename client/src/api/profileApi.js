import axiosInstance from './axiosInstance';

export const updateProfile = (data) => axiosInstance.put('/auth/profile', data);
export const changePassword = (data) => axiosInstance.put('/auth/change-password', data);
