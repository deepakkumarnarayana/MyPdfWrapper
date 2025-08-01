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
    const timestamp = new Date().toISOString();
    const caller = new Error().stack?.split('\n')[2]?.trim() || 'unknown';
    
    console.log(`[SESSION_SERVICE] ${timestamp} - START_SESSION_REQUEST:`, {
      pdf_id: data.pdf_id,
      start_page: data.start_page,
      session_type: data.session_type,
      caller: caller,
      timestamp
    });
    
    try {
      const response = await httpClient.post('/sessions', data);
      
      console.log(`[SESSION_SERVICE] ${new Date().toISOString()} - START_SESSION_SUCCESS:`, {
        session_id: response.data.id,
        pdf_id: response.data.pdf_id,
        started_at: response.data.started_at,
        started_at_parsed: new Date(response.data.started_at).toISOString(),
        current_local_time: new Date().toISOString(),
        user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        session_type: response.data.session_type,
        request_duration_ms: Date.now() - new Date(timestamp).getTime()
      });
      
      return response.data;
    } catch (error) {
      console.error(`[SESSION_SERVICE] ${new Date().toISOString()} - START_SESSION_ERROR:`, {
        error: error,
        data: data,
        caller: caller,
        timestamp
      });
      throw error;
    }
  }

  /**
   * End a reading session
   */
  async endSession(sessionId: number, data: UpdateSessionData): Promise<ReadingSession> {
    const timestamp = new Date().toISOString();
    const caller = new Error().stack?.split('\n')[2]?.trim() || 'unknown';
    const endedAt = data.ended_at || new Date().toISOString();
    
    console.log(`[SESSION_SERVICE] ${timestamp} - END_SESSION_REQUEST:`, {
      session_id: sessionId,
      end_page: data.end_page,
      ended_at: endedAt,
      caller: caller,
      timestamp,
      stack_trace: new Error().stack?.split('\n').slice(1, 6).join('\n')
    });
    
    try {
      const response = await httpClient.put(`/sessions/${sessionId}`, {
        ...data,
        ended_at: endedAt,
      });
      
      console.log(`[SESSION_SERVICE] ${new Date().toISOString()} - END_SESSION_SUCCESS:`, {
        session_id: response.data.id,
        pdf_id: response.data.pdf_id,
        started_at: response.data.started_at,
        ended_at: response.data.ended_at,
        total_time_minutes: response.data.total_time_minutes,
        pages_read: response.data.pages_read,
        request_duration_ms: Date.now() - new Date(timestamp).getTime()
      });
      
      return response.data;
    } catch (error) {
      console.error(`[SESSION_SERVICE] ${new Date().toISOString()} - END_SESSION_ERROR:`, {
        error: error,
        session_id: sessionId,
        data: data,
        caller: caller,
        timestamp
      });
      throw error;
    }
  }

  /**
   * Get sessions for a specific PDF
   */
  async getSessionsForPdf(pdfId: number): Promise<ReadingSession[]> {
    const timestamp = new Date().toISOString();
    
    console.log(`[SESSION_SERVICE] ${timestamp} - GET_SESSIONS_FOR_PDF_REQUEST:`, {
      pdf_id: pdfId,
      timestamp
    });
    
    try {
      const response = await httpClient.get(`/sessions?pdf_id=${pdfId}`);
      
      console.log(`[SESSION_SERVICE] ${new Date().toISOString()} - GET_SESSIONS_FOR_PDF_SUCCESS:`, {
        pdf_id: pdfId,
        sessions_count: response.data.length,
        sessions: response.data.map((s: ReadingSession) => ({
          id: s.id,
          started_at: s.started_at,
          ended_at: s.ended_at,
          total_time_minutes: s.total_time_minutes
        }))
      });
      
      return response.data;
    } catch (error) {
      console.error(`[SESSION_SERVICE] ${new Date().toISOString()} - GET_SESSIONS_FOR_PDF_ERROR:`, {
        error: error,
        pdf_id: pdfId,
        timestamp
      });
      throw error;
    }
  }

  /**
   * Get all recent sessions
   */
  async getRecentSessions(limit: number = 10): Promise<ReadingSession[]> {
    const timestamp = new Date().toISOString();
    
    console.log(`[SESSION_SERVICE] ${timestamp} - GET_RECENT_SESSIONS_REQUEST:`, {
      limit: limit,
      timestamp
    });
    
    try {
      const response = await httpClient.get(`/sessions?limit=${limit}`);
      
      console.log(`[SESSION_SERVICE] ${new Date().toISOString()} - GET_RECENT_SESSIONS_SUCCESS:`, {
        limit: limit,
        sessions_count: response.data.length,
        recent_sessions: response.data.slice(0, 3).map((s: ReadingSession) => ({
          id: s.id,
          started_at: s.started_at,
          ended_at: s.ended_at,
          total_time_minutes: s.total_time_minutes
        }))
      });
      
      return response.data;
    } catch (error) {
      console.error(`[SESSION_SERVICE] ${new Date().toISOString()} - GET_RECENT_SESSIONS_ERROR:`, {
        error: error,
        limit: limit,
        timestamp
      });
      throw error;
    }
  }
}

export const readingSessionService = new ReadingSessionService();