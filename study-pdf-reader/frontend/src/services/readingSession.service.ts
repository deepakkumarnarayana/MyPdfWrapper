import { httpClient } from './http.client';

export interface ReadingSession {
  id: number;
  pdf_id: number;
  started_at: string;
  ended_at?: string;
  start_page?: number;
  end_page?: number;
  pages_read: number;
  total_time_minutes: number;
  session_type: string;
}

export interface CreateSessionData {
  pdf_id: number;
  start_page?: number;
  session_type?: string;
}

export interface UpdateSessionData {
  end_page?: number;
  ended_at?: string;
}

class ReadingSessionService {
  /**
   * Start a new reading session
   */
  async startSession(data: CreateSessionData): Promise<ReadingSession> {
    const response = await httpClient.post('/sessions', data);
    return response.data;
  }

  /**
   * End a reading session
   */
  async endSession(sessionId: number, data: UpdateSessionData): Promise<ReadingSession> {
    const response = await httpClient.put(`/sessions/${sessionId}`, {
      ...data,
      ended_at: data.ended_at || new Date().toISOString(),
    });
    return response.data;
  }

  /**
   * Get sessions for a specific PDF
   */
  async getSessionsForPdf(pdfId: number): Promise<ReadingSession[]> {
    const response = await httpClient.get(`/sessions?pdf_id=${pdfId}`);
    return response.data;
  }

  /**
   * Get all recent sessions
   */
  async getRecentSessions(limit: number = 10): Promise<ReadingSession[]> {
    const response = await httpClient.get(`/sessions?limit=${limit}`);
    return response.data;
  }
}

export const readingSessionService = new ReadingSessionService();