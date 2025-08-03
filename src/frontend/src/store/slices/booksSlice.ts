import { StateCreator } from 'zustand';
import { Book } from '../../types/dashboard';
import { booksApi } from '../../services/api/books.api';
import { AppStore } from '../index';

export interface BooksSlice {
  // State
  books: Book[];
  booksLoading: boolean;
  booksError: string | null;
  uploadProgress: number | null;

  // Actions
  fetchBooks: () => Promise<void>;
  createBook: (bookData: Partial<Book>) => Promise<Book>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  uploadBook: (file: File) => Promise<Book>;
  searchBooks: (query: string) => Promise<Book[]>;
}

export const createBooksSlice: StateCreator<AppStore, [], [], BooksSlice> = (set) => ({
  // Initial state
  books: [],
  booksLoading: false,
  booksError: null,
  uploadProgress: null,

  // Actions
  fetchBooks: async () => {
    set(state => ({
      ...state,
      booksLoading: true,
      booksError: null
    }));

    try {
      const books = await booksApi.getBooks();
      set(state => ({
        ...state,
        books: books,
        booksLoading: false
      }));
    } catch (error) {
      set(state => ({
        ...state,
        booksError: error instanceof Error ? error.message : 'Failed to fetch books',
        booksLoading: false
      }));
    }
  },

  createBook: async (bookData: Partial<Book>) => {
    try {
      const response = await booksApi.createBook(bookData);
      set(state => ({
        ...state,
        books: [...state.books, response.data]
      }));
      return response.data;
    } catch (error) {
      set(state => ({
        ...state,
        booksError: error instanceof Error ? error.message : 'Failed to create book'
      }));
      throw error;
    }
  },

  updateBook: async (id: string, updates: Partial<Book>) => {
    try {
      const response = await booksApi.updateBook(id, updates);
      set(state => ({
        ...state,
        books: state.books.map(book => book.id === id ? response.data : book)
      }));
    } catch (error) {
      set(state => ({
        ...state,
        booksError: error instanceof Error ? error.message : 'Failed to update book'
      }));
      throw error;
    }
  },

  deleteBook: async (id: string) => {
    try {
      await booksApi.deleteBook(id);
      set(state => ({
        ...state,
        books: state.books.filter(book => book.id !== id)
      }));
    } catch (error) {
      set(state => ({
        ...state,
        booksError: error instanceof Error ? error.message : 'Failed to delete book'
      }));
      throw error;
    }
  },

  uploadBook: async (file: File) => {
    set(state => ({
      ...state,
      uploadProgress: 0,
      booksError: null
    }));

    try {
      const response = await booksApi.uploadBook(file, (progress) => {
        set(state => ({
          ...state,
          uploadProgress: progress
        }));
      });

      set(state => ({
        ...state,
        books: [...state.books, response.data],
        uploadProgress: null
      }));

      return response.data;
    } catch (error) {
      set(state => ({
        ...state,
        booksError: error instanceof Error ? error.message : 'Failed to upload book',
        uploadProgress: null
      }));
      throw error;
    }
  },

  searchBooks: async (query: string) => {
    try {
      const response = await booksApi.searchBooks(query);
      return response.data;
    } catch (error) {
      set(state => ({
        ...state,
        booksError: error instanceof Error ? error.message : 'Search failed'
      }));
      throw error;
    }
  },
});
