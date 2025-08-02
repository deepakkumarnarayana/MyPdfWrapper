import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Snackbar, Alert, Chip, CircularProgress } from '@mui/material';
import { ArrowBack, PlayArrow, Stop, History } from '@mui/icons-material';
import { readingSessionService, ReadingSession } from '../../services/readingSession.service';
import { pdfService } from '../../services/pdfService';
import { SessionStatusPanel } from './SessionStatusPanel';
import { SessionHistoryModal } from './SessionHistoryModal';
import { NightModeToggle } from './NightModeToggle';
import { useUI } from '../../store';

export const FullPdfViewer: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { pdfNightMode } = useUI();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track renders to identify React StrictMode double-mounting
  const renderCount = React.useRef(0);
  renderCount.current += 1;
  
  // Component lifecycle logging
  console.log(`[PDF_VIEWER] ${new Date().toISOString()} - COMPONENT_RENDER:`, {
    render_count: renderCount.current,
    bookId,
    location: window.location.href,
    timestamp: new Date().toISOString(),
    strict_mode_possible: renderCount.current > 1
  });

  // Monitor component mount/unmount lifecycle
  useEffect(() => {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - COMPONENT_MOUNTED:`, {
      bookId,
      location: window.location.href,
      render_count: renderCount.current
    });
    
    // Add navigation monitoring
    const handlePopState = (event: PopStateEvent) => {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - NAVIGATION_POPSTATE:`, {
        bookId,
        event_state: event.state,
        current_url: window.location.href,
        has_current_session: !!currentSession
      });
    };
    
    window.addEventListener('popstate', handlePopState);
    
    return () => {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - COMPONENT_UNMOUNTING:`, {
        bookId,
        has_current_session: !!currentSession,
        session_id: currentSession?.id,
        reason: 'component_unmount',
        render_count: renderCount.current
      });
      
      window.removeEventListener('popstate', handlePopState);
    };
  }, []); // Empty dependency array - runs only on mount/unmount

  // Session tracking state
  const [currentSession, setCurrentSession] = useState<ReadingSession | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Monitor currentSession state changes
  useEffect(() => {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - SESSION_STATE_CHANGED:`, {
      previous_session: 'tracked_in_state',
      current_session: currentSession ? {
        id: currentSession.id,
        pdf_id: currentSession.pdf_id,
        started_at: currentSession.started_at,
        ended_at: currentSession.ended_at
      } : null,
      bookId,
      current_page: currentPage,
      stack_trace: new Error().stack?.split('\n').slice(1, 4).join('\n')
    });
  }, [currentSession, bookId, currentPage]);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [sessionNotification, setSessionNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'info' });

  useEffect(() => {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - PDF_FETCH_EFFECT_TRIGGERED:`, { bookId });
    
    const fetchPdfUrl = async () => {
      if (!bookId) {
        console.warn(`[PDF_VIEWER] ${new Date().toISOString()} - PDF_FETCH_NO_BOOK_ID`);
        setError('No book ID provided.');
        setLoading(false);
        return;
      }
      try {
        console.log(`[PDF_VIEWER] ${new Date().toISOString()} - PDF_FETCH_START:`, { bookId });
        setLoading(true);
        const url = await pdfService.getBookPdfUrl(bookId);
        setPdfUrl(url);
        // You might want to fetch book details here as well
        // For now, we'll just use the bookId as a placeholder title
        setBookTitle(`Book ${bookId}`);
        console.log(`[PDF_VIEWER] ${new Date().toISOString()} - PDF_FETCH_SUCCESS:`, { bookId, url });
      } catch (err) {
        console.error(`[PDF_VIEWER] ${new Date().toISOString()} - PDF_FETCH_ERROR:`, { bookId, error: err });
        setError('Failed to load PDF. Please try again later.');
        console.error('Error fetching PDF URL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPdfUrl();
  }, [bookId]);
  
  const startReadingSession = useCallback(async () => {
    const timestamp = new Date().toISOString();
    const caller = new Error().stack?.split('\n')[2]?.trim() || 'manual_user_click';
    
    console.log(`[PDF_VIEWER] ${timestamp} - START_SESSION_TRIGGERED:`, {
      bookId,
      caller,
      current_session: currentSession?.id,
      timestamp
    });
    
    try {
      // For now, using a fixed PDF ID - this should come from your book/PDF mapping
      const pdfId = parseInt(bookId?.replace('book-', '') || '1');
      
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - START_SESSION_CALLING_SERVICE:`, {
        bookId,
        pdfId,
        start_page: 1,
        session_type: 'reading'
      });
      
      const session = await readingSessionService.startSession({
        pdf_id: pdfId,
        start_page: 1,
        session_type: 'reading'
      });
      
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - START_SESSION_SUCCESS_SETTING_STATE:`, {
        session_id: session.id,
        bookId,
        backend_started_at: session.started_at
      });
      
      setCurrentSession(session);
      
      // Show success notification
      setSessionNotification({
        open: true,
        message: 'Reading session started! 📚',
        severity: 'success',
      });
      
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - START_SESSION_COMPLETE`);
    } catch (error) {
      console.error(`[PDF_VIEWER] ${new Date().toISOString()} - START_SESSION_ERROR:`, { error, bookId });
      setSessionNotification({
        open: true,
        message: 'Failed to start reading session',
        severity: 'error',
      });
    }
  }, [bookId, currentSession?.id]);

  const endReadingSession = useCallback(async () => {
    const timestamp = new Date().toISOString();
    const caller = new Error().stack?.split('\n')[2]?.trim() || 'unknown';
    
    console.log(`[PDF_VIEWER] ${timestamp} - END_SESSION_TRIGGERED:`, {
      has_current_session: !!currentSession,
      session_id: currentSession?.id,
      current_page: currentPage,
      caller,
      timestamp,
      stack_trace: new Error().stack?.split('\n').slice(1, 8).join('\n')
    });
    
    if (!currentSession) {
      console.warn(`[PDF_VIEWER] ${new Date().toISOString()} - END_SESSION_NO_CURRENT_SESSION`);
      return;
    }

    try {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - END_SESSION_CALLING_SERVICE:`, {
        session_id: currentSession.id,
        end_page: currentPage,
        started_at: currentSession.started_at
      });
      
      await readingSessionService.endSession(currentSession.id, {
        end_page: currentPage,
        ended_at: new Date().toISOString(),
      });
      
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - END_SESSION_SUCCESS_CLEARING_STATE:`, {
        session_id: currentSession.id
      });
      
      // Calculate basic session info for notification
      const pagesRead = currentPage - (currentSession.start_page || 1) + 1;
      
      setCurrentSession(null);
      
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - END_SESSION_STATS:`, {
        session_id: currentSession.id,
        time_spent_minutes: timeSpentMinutes,
        time_spent_seconds: timeSpentSeconds,
        pages_read: pagesRead,
        start_page: currentSession.start_page,
        end_page: currentPage
      });
      
      setSessionNotification({
        open: true,
        message: `Session ended! Read ${pagesRead} pages 🎉`,
        severity: 'success',
      });
      
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - END_SESSION_COMPLETE`);
    } catch (error) {
      console.error(`[PDF_VIEWER] ${new Date().toISOString()} - END_SESSION_ERROR:`, { 
        error, 
        session_id: currentSession.id,
        caller
      });
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
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - PAGE_CHANGE_LISTENER_SETUP`);
    
    const handleMessage = (event: MessageEvent) => {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - MESSAGE_RECEIVED:`, {
        origin: event.origin,
        window_origin: window.location.origin,
        data_type: event.data?.type,
        data: event.data
      });
      
      if (event.origin === window.location.origin) {
        if (event.data && event.data.type === 'pagechange') {
          const newPage = event.data.page;
          console.log(`[PDF_VIEWER] ${new Date().toISOString()} - PAGE_CHANGE_DETECTED:`, {
            old_page: currentPage,
            new_page: newPage,
            session_active: !!currentSession
          });
          
          if (newPage && newPage !== currentPage) {
            setCurrentPage(newPage);
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - PAGE_CHANGE_LISTENER_CLEANUP`);
      window.removeEventListener('message', handleMessage);
    };
  }, [currentPage, currentSession]);

  // End session when component unmounts or user navigates away  
  useEffect(() => {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - CLEANUP_EFFECT_SETUP:`, {
      has_current_session: !!currentSession,
      session_id: currentSession?.id
    });
    
    const handleBeforeUnload = () => {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - BEFORE_UNLOAD_TRIGGERED`);
      // End session on page unload/refresh
      if (currentSession) {
        console.log(`[PDF_VIEWER] ${new Date().toISOString()} - BEFORE_UNLOAD_ENDING_SESSION:`, {
          session_id: currentSession.id
        });
        endReadingSession();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup function only runs on component unmount
    return () => {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - COMPONENT_UNMOUNT_CLEANUP:`, {
        has_current_session: !!currentSession,
        session_id: currentSession?.id,
        reason: 'component_unmount',
        stack_trace: new Error().stack?.split('\n').slice(1, 3).join('\n')
      });
      
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // End session only on actual component unmount (navigation away)
      if (currentSession) {
        console.log(`[PDF_VIEWER] ${new Date().toISOString()} - UNMOUNT_ENDING_SESSION:`, {
          session_id: currentSession.id
        });
        endReadingSession();
      }
    };
  }, []); // Empty dependencies - only run on mount/unmount

  // Handle PDF night mode changes
  useEffect(() => {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - NIGHT_MODE_CHANGED:`, { 
      pdfNightMode,
      bookId 
    });

    // Apply night mode styling to the PDF iframe
    const iframe = document.querySelector('iframe[title="PDF Viewer"]') as HTMLIFrameElement;
    if (iframe?.contentDocument) {
      const iframeDoc = iframe.contentDocument;
      const iframeBody = iframeDoc.body;
      
      if (pdfNightMode) {
        iframeBody.classList.add('pdf-night-mode');
        // Load night mode CSS if not already loaded
        if (!iframeDoc.querySelector('#pdf-night-mode-styles')) {
          const link = iframeDoc.createElement('link');
          link.id = 'pdf-night-mode-styles';
          link.rel = 'stylesheet';
          link.href = '/pdf-night-mode.css';
          iframeDoc.head.appendChild(link);
        }
      } else {
        iframeBody.classList.remove('pdf-night-mode');
      }
    } else {
      // If iframe is not ready yet, wait and try again
      const retryApplyNightMode = setTimeout(() => {
        const retryIframe = document.querySelector('iframe[title="PDF Viewer"]') as HTMLIFrameElement;
        if (retryIframe?.contentDocument) {
          const iframeDoc = retryIframe.contentDocument;
          const iframeBody = iframeDoc.body;
          
          if (pdfNightMode) {
            iframeBody.classList.add('pdf-night-mode');
            if (!iframeDoc.querySelector('#pdf-night-mode-styles')) {
              const link = iframeDoc.createElement('link');
              link.id = 'pdf-night-mode-styles';
              link.rel = 'stylesheet';
              link.href = '/pdf-night-mode.css';
              iframeDoc.head.appendChild(link);
            }
          } else {
            iframeBody.classList.remove('pdf-night-mode');
          }
        }
      }, 1000);

      return () => clearTimeout(retryApplyNightMode);
    }
  }, [pdfNightMode, bookId]);

  const handleBack = () => {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - HANDLE_BACK_TRIGGERED:`, {
      has_current_session: !!currentSession,
      session_id: currentSession?.id
    });
    
    // End session before navigating if one is active
    if (currentSession) {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - HANDLE_BACK_ENDING_SESSION_BEFORE_NAVIGATION`);
      endReadingSession();
    }
    
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - HANDLE_BACK_NAVIGATING_TO_DASHBOARD`);
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

        {/* Night Mode Toggle */}
        <NightModeToggle />

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