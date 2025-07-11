import { IBooksApi } from '../interfaces/IBooksApi';
import { Book } from '../../../types/dashboard';
import { httpClient } from '../../http.client';

export class RealBooksApi implements IBooksApi {
  async getBooks(): Promise<Book[]> {
    const response = await httpClient.get('/books');
    return response.data;
  }

  async getBook(id: string): Promise<Book | null> {
    try {
      const response = await httpClient.get(`/books/${id}`);
      return response.data;
    } catch (error) {
      return null;
    }
  }

  async uploadBook(file: File, onProgress?: (progress: number) => void): Promise<{ data: Book }> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await httpClient.post('/books', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      },
    });
    
    return { data: response.data };
  }

  async createBook(bookData: Partial<Book>): Promise<{ data: Book }> {
    const response = await httpClient.post('/books', bookData);
    return { data: response.data };
  }

  async updateBook(id: string, updates: Partial<Book>): Promise<{ data: Book }> {
    const response = await httpClient.put(`/books/${id}`, updates);
    return { data: response.data };
  }

  async deleteBook(id: string): Promise<void> {
    await httpClient.delete(`/books/${id}`);
  }

  async searchBooks(query: string): Promise<{ data: Book[] }> {
    const response = await httpClient.get('/books/search', {
      params: { q: query }
    });
    return { data: response.data };
  }
}