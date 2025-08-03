import { SystemService, DashboardStats } from '../../../types/dashboard';

export interface ISystemApi {
  getSystemServices(): Promise<SystemService[]>;
  runHealthCheck(): Promise<{ success: boolean; message: string }>;
  getStats(): Promise<DashboardStats>;
  startLearningSession(): Promise<{ sessionId: string; message: string }>;
}