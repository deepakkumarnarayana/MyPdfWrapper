import { apiService } from './ApiService';
import { Flashcard, ManualFlashcardPayload } from '../types/flashcards';

class FlashcardService {
  async createManualFlashcard(payload: ManualFlashcardPayload): Promise<Flashcard> {
    try {
      // ApiService returns data directly, no need for .data
      return await apiService.post<Flashcard>('/flashcards', payload);
    } catch (error) {
      console.error('Error creating manual flashcard:', error);
      throw error;
    }
  }
}

export const flashcardService = new FlashcardService();
