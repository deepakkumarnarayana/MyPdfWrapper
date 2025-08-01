import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Chip } from '@mui/material';
import { ArrowBack, Timer } from '@mui/icons-material';
import { readingSessionService, ReadingSession } from '../../services/readingSession.service';

// Simple book to PDF mapping
const bookPdfMap: Record<string, string> = {
  'book-1': 'sample-ml-book.pdf',
  'book-2': 'operating-systems-book.pdf', 
  'book-3': 'multipage-sample.pdf',
  'book-4': 'CNSIA.pdf'
};

export const FullPdfViewer: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  // Session tracking state
  const [currentSession, setCurrentSession] = useState<ReadingSession | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const startReadingSession = useCallback(async () => {
    try {
      // For now, using a fixed PDF ID - this should come from your book/PDF mapping
      const pdfId = parseInt(bookId?.replace('book-', '') || '1');
      
      const session = await readingSessionService.startSession({
        pdf_id: pdfId,
        start_page: 1,
        session_type: 'reading'
      });
      
      setCurrentSession(session);
    } catch (error) {
      console.error('Failed to start reading session:', error);
    }
  }, [bookId]);

  const endReadingSession = useCallback(async () => {
    if (!currentSession) return;

    try {
      await readingSessionService.endSession(currentSession.id, {
        end_page: currentPage,
        ended_at: new Date().toISOString(),
      });
      
      setCurrentSession(null);
    } catch (error) {
      console.error('Failed to end reading session:', error);
    }
  }, [currentSession, currentPage]);

  // Start reading session when component mounts
  useEffect(() => {
    if (bookId) {
      startReadingSession();
    }
  }, [bookId, startReadingSession]);

  // Listen for page changes from PDF.js viewer for session tracking
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin) {
        if (event.data && event.data.type === 'pagechange') {
          const newPage = event.data.page;
          if (newPage && newPage !== currentPage) {
            setCurrentPage(newPage);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentPage]);

  // End session when component unmounts or user navigates away
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSession) {
        endReadingSession();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (currentSession) {
        endReadingSession();
      }
    };
  }, [currentSession, endReadingSession]);


  const handleBack = () => {
    // End session before navigating
    if (currentSession) {
      endReadingSession();
    }
    navigate('/dashboard');
  };

  if (!bookId || !bookPdfMap[bookId]) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">PDF not found for book: {bookId}</Typography>
        <Button variant="contained" startIcon={<ArrowBack />} onClick={handleBack} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  // Direct PDF path and full PDF.js viewer with all features
  // PDF.js handles last read page functionality natively via localStorage
  const pdfPath = `/sample-pdfs/${bookPdfMap[bookId]}`;
  const viewerUrl = `/pdfjs-full/viewer.html?file=${encodeURIComponent(pdfPath)}`;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#525659' }}>
      {/* Simple header */}
      <Box sx={{ 
        p: 2, 
        backgroundColor: '#404040',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: 1,
        borderColor: 'divider'
      }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={handleBack}
          sx={{ color: 'white', borderColor: 'white' }}
        >
          Back
        </Button>
        <Typography variant="h6" sx={{ color: 'white', flex: 1 }}>
          {bookPdfMap[bookId]} - Full PDF.js Viewer (All Features)
        </Typography>
        
        {/* Session indicator */}
        {currentSession && (
          <Chip
            icon={<Timer />}
            label={`Reading Session: Page ${currentPage}`}
            variant="outlined"
            size="small"
            sx={{
              color: 'white',
              borderColor: 'white',
              '& .MuiChip-icon': { color: 'white' }
            }}
          />
        )}
      </Box>

      {/* Full PDF.js viewer with all features */}
      <Box sx={{ flexGrow: 1 }}>
        <iframe
          src={viewerUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title="PDF Viewer"
        />
      </Box>
    </Box>
  );
};