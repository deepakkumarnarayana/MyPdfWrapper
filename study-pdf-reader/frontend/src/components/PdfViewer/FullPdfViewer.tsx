import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Snackbar, Alert, Chip, CircularProgress } from '@mui/material';
import { ArrowBack, PlayArrow, Stop, History } from '@mui/icons-material';
import { readingSessionService, ReadingSession } from '../../services/readingSession.service';
import { pdfService } from '../../services/pdfService';
import { SessionStatusPanel } from './SessionStatusPanel';
import { SessionHistoryModal } from './SessionHistoryModal';

export const FullPdfViewer: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Session tracking state
  const [currentSession, setCurrentSession] = useState<ReadingSession | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [sessionNotification, setSessionNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    const fetchPdfUrl = async () => {
      if (!bookId) {
        setError('No book ID provided.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const url = await pdfService.getBookPdfUrl(bookId);
        setPdfUrl(url);
        // You might want to fetch book details here as well
        // For now, we'll just use the bookId as a placeholder title
        setBookTitle(`Book ${bookId}`);
      } catch (err) {
        setError('Failed to load PDF. Please try again later.');
        console.error('Error fetching PDF URL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPdfUrl();
  }, [bookId]);
  
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
      
      // Show success notification
      setSessionNotification({
        open: true,
        message: 'Reading session started! 📚',
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to start reading session:', error);
      setSessionNotification({
        open: true,
        message: 'Failed to start reading session',
        severity: 'error',
      });
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
      
      // Show session summary notification
      const timeSpent = Math.floor((new Date().getTime() - new Date(currentSession.started_at).getTime()) / 60000);
      const pagesRead = currentPage - (currentSession.start_page || 1) + 1;
      
      setSessionNotification({
        open: true,
        message: `Session ended! Read ${pagesRead} pages in ${timeSpent} minutes 🎉`,
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to end reading session:', error);
      setSessionNotification({
        open: true,
        message: 'Failed to end reading session',
        severity: 'error',
      });
    }
  }, [currentSession, currentPage]);

  // Removed auto-start - user now controls session start manually

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
    // End session before navigating if one is active
    if (currentSession) {
      endReadingSession();
    }
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading PDF...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">{error}</Typography>
        <Button variant="contained" startIcon={<ArrowBack />} onClick={handleBack} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  // Direct PDF path and full PDF.js viewer with all features
  // PDF.js handles last read page functionality natively via localStorage
  const viewerUrl = `/pdfjs-full/viewer.html?file=${encodeURIComponent(pdfUrl || '')}`;
  
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#525659' }}>
      {/* Enhanced header with session controls */}
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
          {bookTitle} - Full PDF.js Viewer
        </Typography>


        {/* Session Status Indicator */}
        {currentSession ? (
          <Chip
            icon={<Stop />}
            label="Session Active"
            color="success"
            variant="outlined"
            sx={{ 
              color: '#4CAF50', 
              borderColor: '#4CAF50',
              fontWeight: 600
            }}
          />
        ) : (
          <Chip
            icon={<PlayArrow />}
            label="No Session"
            variant="outlined"
            sx={{ 
              color: 'rgba(255,255,255,0.7)', 
              borderColor: 'rgba(255,255,255,0.3)'
            }}
          />
        )}

        {/* Session Control Buttons */}
        {currentSession ? (
          <Button
            variant="contained"
            startIcon={<Stop />}
            onClick={endReadingSession}
            color="error"
            size="small"
            sx={{ minWidth: 120 }}
          >
            End Session
          </Button>
        ) : (
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            onClick={startReadingSession}
            color="success"
            size="small"
            sx={{ minWidth: 120 }}
          >
            Start Session
          </Button>
        )}

        <Button
          variant="outlined"
          startIcon={<History />}
          onClick={() => setHistoryModalOpen(true)}
          sx={{ 
            color: 'white', 
            borderColor: 'white',
            minWidth: 100
          }}
        >
          History
        </Button>
      </Box>

      {/* Full PDF.js viewer with all features */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        <iframe
          src={viewerUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title="PDF Viewer"
        />

        {/* Enhanced Session Status Panel - Only show when session is active */}
        {currentSession && (
          <SessionStatusPanel
            currentSession={currentSession}
            currentPage={currentPage}
            totalPages={300} // This should come from PDF metadata
            onEndSession={endReadingSession}
            onOpenHistory={() => setHistoryModalOpen(true)}
          />
        )}
      </Box>

      {/* Session History Modal */}
      <SessionHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        currentPdfId={currentSession?.pdf_id}
      />

      {/* Session Notifications */}
      <Snackbar
        open={sessionNotification.open}
        autoHideDuration={4000}
        onClose={() => setSessionNotification(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSessionNotification(prev => ({ ...prev, open: false }))}
          severity={sessionNotification.severity}
          sx={{ width: '100%' }}
        >
          {sessionNotification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};