/**
 * PDF Service
 * 
 * Uses centralized ApiService for all HTTP operations.
 * Maintains clean separation of concerns.
 */

import { apiService } from './ApiService';
import { PDF, Flashcard, FlashcardGenerationResponse } from '../types';

export const pdfService = {
  async getAllPDFs(): Promise<PDF[]> {
    return apiService.get<PDF[]>('/documents');
  },

  async getPDF(id: number): Promise<PDF> {
    return apiService.get<PDF>(`/documents/${id}`);
  },

  async uploadPDF(file: File): Promise<PDF> {
    const formData = new FormData();
    formData.append('file', file);
    
    return apiService.postFormData<PDF>('/documents', formData);
  },

  async deletePDF(id: number): Promise<void> {
    return apiService.delete<void>(`/documents/${id}`);
  },

  async getFlashcards(pdfId: number): Promise<Flashcard[]> {
    return apiService.get<Flashcard[]>(`/documents/${pdfId}/flashcards`);
  },

  async generateFlashcards(pdfId: number): Promise<FlashcardGenerationResponse> {
    return apiService.post<FlashcardGenerationResponse>(
      `/documents/${pdfId}/flashcards/generate`
    );
  },

  async updateFlashcard(id: number, data: Partial<Flashcard>): Promise<Flashcard> {
    return apiService.put<Flashcard>(`/flashcards/${id}`, data);
  },

  async deleteFlashcard(id: number): Promise<void> {
    return apiService.delete<void>(`/flashcards/${id}`);
  },

  async getBooks(): Promise<any[]> {
    return apiService.get<any[]>('/documents?document_type=book');
  },

  async getBookPdfUrl(bookId: string): Promise<string> {
    const response = await apiService.get<{ url: string }>(`/documents/${bookId}/url`);
    return response.url;
  },

  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    return apiService.get<{ status: string; service: string; version: string }>('/health');
  },
};