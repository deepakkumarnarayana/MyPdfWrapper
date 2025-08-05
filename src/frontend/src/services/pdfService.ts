import { apiService } from './ApiService';
import { PDF, Flashcard, FlashcardGenerationResponse } from '../types';

export const pdfService = {
  async getAllPDFs(): Promise<PDF[]> {
    return await apiService.get<PDF[]>('/documents');
  },

  async getPDF(id: number): Promise<PDF> {
    return await apiService.get<PDF>(`/documents/${id}`);
  },

  async uploadPDF(file: File): Promise<PDF> {
    const formData = new FormData();
    formData.append('file', file);
    
    return await apiService.postFormData<PDF>('/documents', formData);
  },

  async deletePDF(id: number): Promise<void> {
    await apiService.delete(`/documents/${id}`);
  },

  async getFlashcards(pdfId: number): Promise<Flashcard[]> {
    return await apiService.get<Flashcard[]>(`/documents/${pdfId}/flashcards`);
  },

  async generateFlashcards(pdfId: number): Promise<FlashcardGenerationResponse> {
    return await apiService.post<FlashcardGenerationResponse>(
      `/documents/${pdfId}/flashcards/generate`
    );
  },

  async updateFlashcard(id: number, data: Partial<Flashcard>): Promise<Flashcard> {
    return await apiService.put<Flashcard>(`/flashcards/${id}`, data);
  },

  async deleteFlashcard(id: number): Promise<void> {
    await apiService.delete(`/flashcards/${id}`);
  },

  async getBooks(): Promise<any[]> {
    return await apiService.get('/documents?document_type=book');
  },

  async updateBook(id: string, updates: any): Promise<any> {
    return await apiService.put(`/documents/${id}`, updates);
  },

  async deleteBook(id: string): Promise<void> {
    await apiService.delete(`/documents/${id}`);
  },

  async searchBooks(query: string): Promise<any[]> {
    return await apiService.get(`/documents/search?q=${encodeURIComponent(query)}&document_type=book`);
  },

  async getBookPdfUrl(bookId: string): Promise<string> {
    const response = await apiService.get<{ url: string }>(`/documents/${bookId}/url`);
    return response.url;
  },

  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    return await apiService.get('/health');
  },
};