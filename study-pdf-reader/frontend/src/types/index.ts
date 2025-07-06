export interface PDF {
  id: number
  filename: string
  original_filename: string
  file_path: string
  title?: string
  author?: string
  page_count?: number
  file_size?: number
  created_at: string
  updated_at: string
}

export interface Flashcard {
  id: number
  pdf_id: number
  question: string
  answer: string
  page_number?: number
  difficulty: 'easy' | 'medium' | 'hard'
  category?: string
  times_reviewed: number
  correct_answers: number
  last_reviewed?: string
  next_review?: string
  created_at: string
  updated_at: string
}

export interface Annotation {
  id: number
  pdf_id: number
  page_number: number
  x_coordinate: number
  y_coordinate: number
  width: number
  height: number
  text?: string
  note?: string
  annotation_type: 'highlight' | 'note' | 'bookmark'
  color: string
  created_at: string
  updated_at: string
}

export interface StudySession {
  id: number
  pdf_id: number
  started_at: string
  ended_at?: string
  flashcards_reviewed: number
  correct_answers: number
  total_time_minutes: number
}

export interface UploadResponse {
  message: string
  pdf?: PDF
}

export interface FlashcardGenerationResponse {
  message: string
  flashcards: Flashcard[]
}

export interface APIError {
  detail: string
}