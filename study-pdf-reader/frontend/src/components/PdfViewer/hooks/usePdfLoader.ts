import { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDF_BOOK_PATHS } from '../constants';

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
    
    // Get PDF path from constants or use default
    const pdfPath = PDF_BOOK_PATHS[bookId as keyof typeof PDF_BOOK_PATHS] || 
                   '/sample-pdfs/operating-systems-book.pdf';
    
    const loadingTask = pdfjsLib.getDocument({
      url: pdfPath,
      cMapUrl: new URL('pdfjs-dist/cmaps/', import.meta.url).toString(),
      cMapPacked: true,
      standardFontDataUrl: new URL('pdfjs-dist/standard_fonts/', import.meta.url).toString(),
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
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    pdfDoc,
    totalPages,
    isLoading,
    error,
  };
};