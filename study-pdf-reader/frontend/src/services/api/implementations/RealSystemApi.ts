import { ISystemApi } from '../interfaces/ISystemApi';
import { SystemService, DashboardStats } from '../../../types/dashboard';
import { httpClient } from '../../http.client';

export class RealSystemApi implements ISystemApi {
  async getSystemServices(): Promise<SystemService[]> {
    const response = await httpClient.get('/system/services');
    return response.data;
  }

  async runHealthCheck(): Promise<{ success: boolean; message: string }> {
    const response = await httpClient.post('/system/health-check');
    return response.data;
  }

  async getStats(): Promise<DashboardStats> {
    const response = await httpClient.get('/system/stats');
    return response.data;
  }

  async startLearningSession(): Promise<{ sessionId: string; message: string }> {
    const response = await httpClient.post('/system/learning-session');
    return response.data;
  }
}