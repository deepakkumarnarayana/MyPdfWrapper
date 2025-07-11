import { Session } from '../../../types/dashboard';

export interface ISessionsApi {
  getSessions(): Promise<Session[]>;
  createSession(sessionData: Partial<Session>): Promise<{ data: Session }>;
  updateSession(id: string, updates: Partial<Session>): Promise<{ data: Session }>;
  exportSessionToAnki(sessionId: string): Promise<{ success: boolean; message: string }>;
}