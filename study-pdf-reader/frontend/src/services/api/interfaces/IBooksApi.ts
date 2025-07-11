import { Book } from '../../../types/dashboard';

export interface IBooksApi {
  getBooks(): Promise<Book[]>;
  getBook(id: string): Promise<Book | null>;
  uploadBook(file: File, onProgress?: (progress: number) => void): Promise<{ data: Book }>;
  createBook(bookData: Partial<Book>): Promise<{ data: Book }>;
  updateBook(id: string, updates: Partial<Book>): Promise<{ data: Book }>;
  deleteBook(id: string): Promise<void>;
  searchBooks(query: string): Promise<{ data: Book[] }>;
}