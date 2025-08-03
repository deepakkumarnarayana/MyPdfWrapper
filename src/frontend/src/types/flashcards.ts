export enum FlashcardSource {
  MANUAL = 'manual',
  AI = 'ai',
}

export interface Flashcard {
  id: number;
  pdf_id: number;
  question: string;
  answer: string;
  page_number?: number;
  context_text?: string;
  source: FlashcardSource;
  difficulty: string;
  category?: string;
  times_reviewed: number;
  correct_answers: number;
  last_reviewed?: string;
  next_review?: string;
  created_at: string;
  updated_at: string;
}

export interface ManualFlashcardPayload {
  pdf_id: number;
  question: string;
  answer: string;
  page_number?: number;
  context_text?: string;
  coordinates?: { [key: string]: any };
}
