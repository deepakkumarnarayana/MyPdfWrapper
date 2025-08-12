import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { pdfService } from '../../../services/pdfService';
import { PDF } from '../../../types';

// Configure PDF.js worker with better error handling
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.js',
    import.meta.url
  ).toString();
} catch (e) {
  console.error('Failed to configure PDF.js worker:', e);
  // Fallback to CDN worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export const usePdfLoader = (bookId: string | undefined) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookData, setBookData] = useState<PDF | null>(null);
  const [lastReadPage, setLastReadPage] = useState(1);

  useEffect(() => {
    if (!bookId) return;
    
    setIsLoading(true);
    setError(null);
    
    // Clear previous PDF document
    if (pdfDoc) {
      try {
        pdfDoc.destroy();
      } catch (e) {
        console.warn('Error destroying previous PDF:', e);
      }
      setPdfDoc(null);
    }
    
    // Fetch book data from API
    const loadBookData = async () => {
      try {
        const book = await pdfService.getPDF(parseInt(bookId));
        if (!book) {
          setError('Book not found');
          setIsLoading(false);
          return;
        }
        
        setBookData(book);
        setLastReadPage(book.lastReadPage || 1);
        
        // Get PDF URL from API and resolve to absolute URL
        const pdfUrl = await pdfService.getBookPdfUrl(bookId);
        
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
          cMapPacked: true,
        });
        
        let cancelled = false;
        
        loadingTask.promise
          .then((pdf) => {
            if (!cancelled) {
              setPdfDoc(pdf);
              setTotalPages(pdf.numPages);
              setIsLoading(false);
            } else {
              // If cancelled, destroy the loaded PDF
              try {
                pdf.destroy();
              } catch (e) {
                console.warn('Error destroying cancelled PDF:', e);
              }
            }
          })
          .catch((err) => {
            if (!cancelled) {
              console.error('Error loading PDF:', err);
              // Provide more specific error messages
              let errorMessage = 'Failed to load PDF';
              if (err.message.includes('Worker was destroyed')) {
                errorMessage = 'PDF worker was destroyed. Please refresh the page.';
              } else if (err.message.includes('Network error')) {
                errorMessage = 'Network error loading PDF. Please check your connection.';
              } else if (err.message.includes('Invalid PDF')) {
                errorMessage = 'Invalid PDF file format.';
              } else if (err.message) {
                errorMessage = `Failed to load PDF: ${err.message}`;
              }
              setError(errorMessage);
              setIsLoading(false);
            }
          });
        
        return () => {
          cancelled = true;
          try {
            loadingTask.destroy();
          } catch (e) {
            console.warn('Error destroying loading task:', e);
          }
        };
        
      } catch (error) {
        console.error('Error fetching book data:', error);
        setError('Failed to load book data');
        setIsLoading(false);
      }
    };
    
    loadBookData();
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    pdfDoc,
    totalPages,
    isLoading,
    error,
    bookData,
    lastReadPage,
  };
};