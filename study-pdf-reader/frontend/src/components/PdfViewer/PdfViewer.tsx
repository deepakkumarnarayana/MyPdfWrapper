import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, Card, CardContent, Button } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import * as pdfjsLib from 'pdfjs-dist';
import { Book } from '../../types/dashboard';
import { pdfService } from '../../services/pdfService';

import { useHighlights } from './hooks/useHighlights';
import { useTableOfContents } from './hooks/useTableOfContents';
import { usePdfViewer } from './hooks/usePdfViewer';

import { PdfToolbar } from './components/PdfToolbar';
import { TableOfContentsDrawer } from './components/TableOfContentsDrawer';
import { PdfContextMenu } from './components/PdfContextMenu';

import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString();

interface PdfViewerProps {}

export const PdfViewer: React.FC<PdfViewerProps> = () => {
  console.log('🔄 PdfViewer component rendering');
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const tocExtractedRef = useRef(false);

  const {
    viewerRef,
    currentPage,
    setCurrentPage,
    pageInput,
    setPageInput,
    setScale,
    zoomSelect,
    setZoomSelect,
    setRotation,
    scrollToPage,
    pagesRef,
  } = usePdfViewer(pdfDoc, totalPages, []);

  const {
    highlightColor,
    setHighlightColor,
    contextMenu,
    closeContextMenu,
    addHighlight,
    deleteHighlight,
    handleContextMenu,
  } = useHighlights(pagesRef);

  const {
    tocItems,
    isTocOpen,
    tocLoading,
    extractTableOfContents,
    toggleToc,
    handleTocItemClick,
    handleTocItemToggle,
  } = useTableOfContents(pdfDoc, setCurrentPage, setPageInput, scrollToPage);

  useEffect(() => {
    if (!bookId) return;
    
    const loadPdfFromBook = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // First, fetch the book details
        const bookData = await pdfService.getBook(bookId);
        setBook(bookData);
        
        // Then, fetch the PDF file
        const pdfResponse = await pdfService.getPdfFile(bookId);
        const pdfBlob = new Blob([pdfResponse], { type: 'application/pdf' });
        const pdfUrl = URL.createObjectURL(pdfBlob);
        
        // Load the PDF using PDF.js
        const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
        
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setIsLoading(false);
        
        // Clean up the blob URL after loading
        return () => URL.revokeObjectURL(pdfUrl);
        
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        setError(`Failed to load PDF: ${err.message || 'Unknown error'}`);
        setIsLoading(false);
      }
    };
    
    loadPdfFromBook();

    return () => {
      tocExtractedRef.current = false;
    };
  }, [bookId]);

  // Extract table of contents when PDF document is loaded
  useEffect(() => {
    if (pdfDoc && !tocExtractedRef.current) {
      tocExtractedRef.current = true;
      extractTableOfContents(pdfDoc);
    }
  }, [pdfDoc]); // Removed extractTableOfContents dependency to prevent re-renders

  const handleBack = () => navigate('/dashboard');

  const handlePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => setPageInput(event.target.value);

  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      scrollToPage(pageNum);
    } else {
      setPageInput(currentPage.toString());
    }
  };

  const handleZoomChange = useMemo(() => (value: string) => {
    setZoomSelect(value);
    if (value !== 'auto' && value !== 'page-fit') {
      setScale(parseInt(value) / 100);
    }
  }, [setZoomSelect, setScale]);

  const zoomOptions = useMemo(() => [
    { value: '25', label: '25%' },
    { value: '50', label: '50%' },
    { value: '75', label: '75%' },
    { value: '100', label: '100%' },
    { value: '120', label: '120%' },
    { value: '125', label: '125%' },
    { value: '150', label: '150%' },
    { value: '200', label: '200%' },
    { value: '300', label: '300%' },
    { value: '400', label: '400%' },
    { value: 'auto', label: 'Fit Width' },
    { value: 'page-fit', label: 'Fit Page' },
  ], []);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: 2, backgroundColor: '#525659' }}>
        <CircularProgress size={48} sx={{ color: 'white' }} />
        <Typography variant="h6" sx={{ color: 'white' }}>Loading PDF...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, backgroundColor: '#525659', minHeight: '100vh' }}>
        <Card>
          <CardContent>
            <Typography color="error" variant="h6" gutterBottom>{error}</Typography>
            <Button variant="contained" startIcon={<ArrowBack />} onClick={handleBack} sx={{ mt: 2 }}>Back to Dashboard</Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PdfToolbar
        bookTitle={book?.title || 'Loading...'}
        handleBack={handleBack}
        toggleToc={toggleToc}
        tocItems={tocItems}
        goToFirstPage={() => scrollToPage(1)}
        goToPreviousPage={() => scrollToPage(currentPage - 1)}
        goToNextPage={() => scrollToPage(currentPage + 1)}
        goToLastPage={() => scrollToPage(totalPages)}
        currentPage={currentPage}
        totalPages={totalPages}
        pageInput={pageInput}
        handlePageInputChange={handlePageInputChange}
        handlePageInputSubmit={handlePageInputSubmit}
        zoomOptions={zoomOptions}
        zoomSelect={zoomSelect}
        handleZoomChange={handleZoomChange}
        rotateLeft={() => setRotation(r => r - 90)}
        rotateRight={() => setRotation(r => r + 90)}
        highlightColors={['#FFFF00', '#00FF00', '#FF0000']}
        highlightColor={highlightColor}
        setHighlightColor={setHighlightColor}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
      
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        <TableOfContentsDrawer
          isTocOpen={isTocOpen}
          toggleToc={toggleToc}
          tocItems={tocItems}
          tocLoading={tocLoading}
          handleTocItemClick={handleTocItemClick}
          handleTocItemToggle={handleTocItemToggle}
          currentPage={currentPage}
        />

        <Box
          ref={viewerRef}
          onContextMenu={handleContextMenu}
          sx={{
            flexGrow: 1,
            overflow: 'auto',
            backgroundColor: darkMode ? '#303030' : '#525659',
            p: 2,
            '& .page-container': {
              filter: darkMode ? 'invert(1) hue-rotate(180deg)' : 'none',
              boxShadow: darkMode ? '0 2px 10px rgba(255, 255, 255, 0.15)' : '0 2px 10px rgba(0, 0, 0, 0.3)',
              border: darkMode ? '1px solid #555' : '1px solid #ccc',
            },
            '& .page-container .highlight, & .page-container .annotationLayer': {
              filter: darkMode ? 'invert(1) hue-rotate(180deg)' : 'none',
            },
          }}
        >
          {/* Pages are inserted here by the usePdfViewer hook */}
        </Box>
      </Box>
      
      <PdfContextMenu
        contextMenu={contextMenu}
        setContextMenu={closeContextMenu}
        deleteHighlight={deleteHighlight}
        addHighlight={addHighlight}
        highlightColor={highlightColor}
      />
    </Box>
  );
};


