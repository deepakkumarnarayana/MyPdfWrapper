import { apiService } from './ApiService';
import { PDF, Flashcard, FlashcardGenerationResponse } from '../types';
import { environment } from '../config/environment';
import { securePdfService } from './SecurePdfService';

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
    // Use secure signed URL approach to prevent document ID enumeration
    // This implements expert-recommended security practices
    try {
      const signedUrlResponse = await apiService.get<{
        signed_url: string;
        expires_at: string;
        valid_for: string;
      }>(`/documents/${bookId}/signed-url`);
      
      // Return the signed URL directly (already secure)
      const signedPath = signedUrlResponse.signed_url.startsWith('/') 
        ? signedUrlResponse.signed_url.substring(1)  // Remove leading slash
        : signedUrlResponse.signed_url;
      return `${environment.backendBaseUrl}/${signedPath}`;
    } catch (error) {
      // Fallback to direct content (will be secured by ownership check)
      console.warn('Failed to get signed URL, using direct content endpoint:', error);
      return `${environment.backendBaseUrl}/api/v1/documents/${bookId}/content`;
    }
  },

  // Helper method to determine if URL is external
  isExternalUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const currentOrigin = window.location.origin;
      return urlObj.origin !== currentOrigin;
    } catch {
      return false;
    }
  },

  // New method: Load PDF securely for viewer
  async loadPdfSecurely(bookId: string): Promise<string> {
    const pdfUrl = await this.getBookPdfUrl(bookId);
    
    // Only use proxy for truly external URLs (https://)
    if (this.isExternalUrl(pdfUrl) && pdfUrl.startsWith('https://') && pdfUrl.endsWith('.pdf')) {
      return await securePdfService.loadPdfForViewer(pdfUrl);
    }
    
    // For internal URLs, return as-is (they're already secured by backend auth)
    return pdfUrl;
  },

  // Method to load external PDF through proxy (for future use)
  async loadExternalPdf(externalUrl: string): Promise<string> {
    if (!externalUrl.startsWith('https://') || !externalUrl.endsWith('.pdf')) {
      throw new Error('External PDF URL must be HTTPS and end with .pdf');
    }
    
    return await securePdfService.loadPdfForViewer(externalUrl);
  },

  async healthCheck(): Promise<{ status: string; service: string; version: string }> {
    return await apiService.get('/health');
  },
};