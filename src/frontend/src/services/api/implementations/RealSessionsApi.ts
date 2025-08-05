import { ISessionsApi } from '../interfaces/ISessionsApi';
import { Session } from '../../../types/dashboard';
import { httpClient } from '../../http.client';

export class RealSessionsApi implements ISessionsApi {
  async getSessions(): Promise<Session[]> {
    const response = await httpClient.get('/sessions');
    return response.data;
  }

  async createSession(sessionData: Partial<Session>): Promise<{ data: Session }> {
    const response = await httpClient.post('/sessions', sessionData);
    return { data: response.data };
  }

  async updateSession(id: string, updates: Partial<Session>): Promise<{ data: Session }> {
    const response = await httpClient.put(`/sessions/${id}`, updates);
    return { data: response.data };
  }

  async exportSessionToAnki(sessionId: string): Promise<{ success: boolean; message: string }> {
    const response = await httpClient.post(`/sessions/${sessionId}/export-anki`);
    return response.data;
  }
}