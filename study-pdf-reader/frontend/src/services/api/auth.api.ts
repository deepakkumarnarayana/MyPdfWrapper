import { User, ApiResponse, NotificationItem } from '../../types';
import { API_ENDPOINTS } from '../../config/api.config';
import { httpGet, httpPost } from '../http.client';

export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    return httpPost(API_ENDPOINTS.auth.login, { email, password });
  },

  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    return httpPost(API_ENDPOINTS.auth.logout);
  },

  async getProfile(): Promise<ApiResponse<User>> {
    return httpGet(API_ENDPOINTS.auth.profile);
  },

  async updateProfile(updates: Partial<User>): Promise<ApiResponse<User>> {
    return httpPost(API_ENDPOINTS.auth.profile, updates);
  },

  async getNotifications(): Promise<ApiResponse<NotificationItem[]>> {
    return httpGet(API_ENDPOINTS.auth.notifications);
  },

  async markNotificationRead(id: string): Promise<ApiResponse<NotificationItem>> {
    return httpPost(`${API_ENDPOINTS.auth.notifications}/${id}/read`);
  },

  async checkAuth(): Promise<ApiResponse<{ authenticated: boolean; user?: User }>> {
    return httpGet(API_ENDPOINTS.auth.checkAuth);
  }
};
