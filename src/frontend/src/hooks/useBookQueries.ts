import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pdfService } from '../services/pdfService';
import { Book } from '../types/dashboard';
import { useAppStore } from '../store';

// Key for caching and invalidation
const booksQueryKey = ['books'];

/**
 * Hook to fetch all books.
 * Handles caching, refetching, loading, and error states automatically.
 */
export const useBooksQuery = () => {
  return useQuery<Book[], Error>({
    queryKey: booksQueryKey,
    queryFn: () => pdfService.getBooks(), // Assumes a getBooks method in pdfService
  });
};

/**
 * Hook to upload a new book.
 * Handles the mutation logic and invalidates the books query on success.
 */
export const useUploadBookMutation = () => {
  const queryClient = useQueryClient();
  const setUploadProgress = useAppStore((state) => state.setUploadProgress);

  return useMutation({
    mutationFn: (file: File) => {
      // Note: Progress tracking would need to be implemented in the apiService.postFormData method
      // For now, we'll use the basic uploadPDF method
      return pdfService.uploadPDF(file);
    },
    onSuccess: () => {
      // When a new book is uploaded successfully, invalidate the 'books' query
      // to automatically refetch the list.
      queryClient.invalidateQueries({ queryKey: booksQueryKey });
      setUploadProgress(null);
    },
    onError: () => {
      // Handle error state, maybe show a notification
      setUploadProgress(null);
    },
  });
};

/**
 * Hook to delete a book.
 */
export const useDeleteBookMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pdfService.deleteBook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: booksQueryKey });
    },
  });
};

/**

 * Hook to update a book.
 */
export const useUpdateBookMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Book> }) =>
      pdfService.updateBook(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: booksQueryKey });
    },
  });
};
