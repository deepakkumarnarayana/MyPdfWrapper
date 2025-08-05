/**
 * Simple Flashcard Service
 * 
 * Uses the simple ApiService for clean, maintainable HTTP communication.
 * Follows YAGNI principles - simple, secure, and works.
 */

import { apiService } from './ApiService';
import { Flashcard, ManualFlashcardPayload } from '../types/flashcards';

export interface FlashcardGenerationRequest {
  content: string;
  count: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  type?: 'definition' | 'concept' | 'application';
  context?: string;
}

export interface FlashcardGenerationResponse {
  flashcards: Flashcard[];
  totalGenerated: number;
  processingTime: number;
  model: string;
}

export interface FlashcardAnalytics {
  totalCreated: number;
  successRate: number;
  averageResponseTime: number;
  mostCommonErrors: string[];
}

class FlashcardService {
  private readonly baseEndpoint = '/flashcards';

  /**
   * Create a manual flashcard
   */
  async createManualFlashcard(payload: ManualFlashcardPayload): Promise<Flashcard> {
    try {
      return await apiService.post<Flashcard>(this.baseEndpoint, payload);
    } catch (error) {
      console.error('[FlashcardService] Error creating manual flashcard:', error);
      throw this.enhanceError(error, 'Failed to create flashcard');
    }
  }

  /**
   * Generate flashcards using AI (backend handles API keys securely)
   */
  async generateFlashcards(
    request: FlashcardGenerationRequest,
    provider: 'claude' | 'openai' = 'claude'
  ): Promise<FlashcardGenerationResponse> {
    try {
      // Backend proxy handles API keys securely
      return await apiService.post<FlashcardGenerationResponse>(
        `/ai-proxy/${provider}/flashcards/generate`,
        request
      );
    } catch (error) {
      console.error('[FlashcardService] Error generating flashcards:', error);
      throw this.enhanceError(error, 'Failed to generate flashcards');
    }
  }

  /**
   * Get all flashcards for a user/session
   */
  async getFlashcards(sessionId?: string, filters?: { difficulty?: string; type?: string }): Promise<Flashcard[]> {
    try {
      const params = new URLSearchParams();
      if (sessionId) params.append('sessionId', sessionId);
      if (filters?.difficulty) params.append('difficulty', filters.difficulty);
      if (filters?.type) params.append('type', filters.type);
      
      const query = params.toString();
      const url = query ? `${this.baseEndpoint}?${query}` : this.baseEndpoint;
      
      return await apiService.get<Flashcard[]>(url);
    } catch (error) {
      console.error('[FlashcardService] Error fetching flashcards:', error);
      throw this.enhanceError(error, 'Failed to load flashcards');
    }
  }

  /**
   * Get a specific flashcard by ID
   */
  async getFlashcard(id: string): Promise<Flashcard> {
    try {
      return await apiService.get<Flashcard>(`${this.baseEndpoint}/${id}`);
    } catch (error) {
      console.error('[FlashcardService] Error fetching flashcard:', error);
      throw this.enhanceError(error, 'Failed to load flashcard');
    }
  }

  /**
   * Update an existing flashcard
   */
  async updateFlashcard(id: string, updates: Partial<Flashcard>): Promise<Flashcard> {
    try {
      return await apiService.put<Flashcard>(`${this.baseEndpoint}/${id}`, updates);
    } catch (error) {
      console.error('[FlashcardService] Error updating flashcard:', error);
      throw this.enhanceError(error, 'Failed to update flashcard');
    }
  }

  /**
   * Delete a flashcard
   */
  async deleteFlashcard(id: string): Promise<void> {
    try {
      await apiService.delete<void>(`${this.baseEndpoint}/${id}`);
    } catch (error) {
      console.error('[FlashcardService] Error deleting flashcard:', error);
      throw this.enhanceError(error, 'Failed to delete flashcard');
    }
  }

  /**
   * Bulk create flashcards
   */
  async bulkCreateFlashcards(flashcards: ManualFlashcardPayload[]): Promise<Flashcard[]> {
    try {
      return await apiService.post<Flashcard[]>(`${this.baseEndpoint}/bulk`, { flashcards });
    } catch (error) {
      console.error('[FlashcardService] Error creating flashcards in bulk:', error);
      throw this.enhanceError(error, 'Failed to create flashcards');
    }
  }

  /**
   * Get flashcard analytics and performance metrics
   */
  async getAnalytics(sessionId?: string): Promise<FlashcardAnalytics> {
    try {
      const url = sessionId 
        ? `${this.baseEndpoint}/analytics?sessionId=${sessionId}`
        : `${this.baseEndpoint}/analytics`;
      
      return await apiService.get<FlashcardAnalytics>(url);
    } catch (error) {
      console.error('[FlashcardService] Error fetching analytics:', error);
      throw this.enhanceError(error, 'Failed to load analytics');
    }
  }

  /**
   * Search flashcards
   */
  async searchFlashcards(
    query: string,
    filters?: { difficulty?: string; type?: string }
  ): Promise<Flashcard[]> {
    try {
      const params = new URLSearchParams({ q: query });
      if (filters?.difficulty) params.append('difficulty', filters.difficulty);
      if (filters?.type) params.append('type', filters.type);
      
      return await apiService.get<Flashcard[]>(`${this.baseEndpoint}/search?${params}`);
    } catch (error) {
      console.error('[FlashcardService] Error searching flashcards:', error);
      throw this.enhanceError(error, 'Failed to search flashcards');
    }
  }

  /**
   * Export flashcards in various formats
   */
  async exportFlashcards(
    format: 'json' | 'csv' | 'anki',
    sessionId?: string
  ): Promise<Blob> {
    try {
      const params = new URLSearchParams({ format });
      if (sessionId) params.append('sessionId', sessionId);
      
      // Note: This would need special handling for blob responses
      return await apiService.get<Blob>(`${this.baseEndpoint}/export?${params}`);
    } catch (error) {
      console.error('[FlashcardService] Error exporting flashcards:', error);
      throw this.enhanceError(error, 'Failed to export flashcards');
    }
  }

  // ==================== PRIVATE METHODS ====================

  private enhanceError(error: any, message: string): Error {
    const enhancedError = new Error(message);
    
    // Add original error details
    if (error.status) {
      enhancedError.message += ` (HTTP ${error.status})`;
    }
    
    if (error.message && error.message !== message) {
      enhancedError.message += `: ${error.message}`;
    }
    
    // Add specific error handling for common cases
    if (error.status === 429) {
      enhancedError.message = 'Rate limit exceeded. Please wait before creating more flashcards.';
    } else if (error.status === 413) {
      enhancedError.message = 'Content too large. Please reduce the text size and try again.';
    } else if (!navigator.onLine) {
      enhancedError.message = 'No internet connection. Please check your network and try again.';
    }
    
    return enhancedError;
  }
}

// Create singleton instance
export const flashcardService = new FlashcardService();
export default flashcardService;