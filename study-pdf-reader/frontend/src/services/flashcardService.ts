import { httpClient } from './http.client';
import { Flashcard, ManualFlashcardPayload } from '../types/flashcards';

class FlashcardService {
  async createManualFlashcard(payload: ManualFlashcardPayload): Promise<Flashcard> {
    try {
      const response = await httpClient.post<Flashcard>('/flashcards', payload);
      return response.data;
    } catch (error) {
      console.error('Error creating manual flashcard:', error);
      throw error;
    }
  }
}

export const flashcardService = new FlashcardService();
