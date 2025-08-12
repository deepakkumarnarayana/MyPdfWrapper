import { StateCreator } from 'zustand';
import { AppStore } from '../index';

export interface BooksSlice {
  // State
  uploadProgress: number | null;
  setUploadProgress: (progress: number | null) => void;
}

export const createBooksSlice: StateCreator<AppStore, [], [], BooksSlice> = (set) => ({
  // Initial state
  uploadProgress: null,

  // Actions
  setUploadProgress: (progress: number | null) => {
    set({ uploadProgress: progress });
  },
});