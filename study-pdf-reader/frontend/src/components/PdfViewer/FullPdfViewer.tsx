import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Snackbar, Alert, Chip, CircularProgress } from '@mui/material';
import { ArrowBack, PlayArrow, Stop, History } from '@mui/icons-material';
import { readingSessionService, ReadingSession } from '../../services/readingSession.service';
import { pdfService } from '../../services/pdfService';
import { SessionStatusPanel } from './SessionStatusPanel';
import { SessionHistoryModal } from './SessionHistoryModal';
import { NightModeToggle } from './NightModeToggle';
import { CreateFlashcardModal } from './CreateFlashcardModal';
import { useUI } from '../../store';

export const FullPdfViewer: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const { pdfNightMode } = useUI();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [bookTitle, setBookTitle] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for manual flashcard creation
  const [selection, setSelection] = useState<{
    text: string;
    position: { top: number; left: number; width: number; height: number; };
  } | null>(null);
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
  
  // Session tracking state
  const [currentSession, setCurrentSession] = useState<ReadingSession | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [sessionNotification, setSessionNotification] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({ open: false, message: '', severity: 'info' });
  
  // Track renders to identify React StrictMode double-mounting
  const renderCount = React.useRef(0);
  renderCount.current += 1;
  
  // Component lifecycle logging (development only) - Reduced frequency
  if (import.meta.env.DEV && renderCount.current % 10 === 0) {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - RENDER_CHECKPOINT:`, {
      render_count: renderCount.current,
      bookId,
      has_session: !!currentSession,
      session_id: currentSession?.id,
      current_page: currentPage,
      loading_state: { loading, initialLoadComplete, hasError: !!error }
    });
  }

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

  const startSession = useCallback(async () => {
    try {
      const pdfId = parseInt(bookId?.replace('book-', '') || '1');
      const session = await readingSessionService.startSession({
        pdf_id: pdfId,
        start_page: 1,
        session_type: 'reading'
      });
      setCurrentSession(session);
      return session;
    } catch (error) {
      console.error('Failed to start session:', error);
      throw error;
    }
  }, [bookId]);

  const endSession = useCallback(async () => {
    if (!currentSession) return;
    try {
      await readingSessionService.endSession(currentSession.id, {
        end_page: currentPage,
        ended_at: new Date().toISOString(),
      });
      setCurrentSession(null);
    } catch (error) {
      console.error('Failed to end session:', error);
      throw error;
    }
  }, [currentSession, currentPage]);

  // Monitor currentSession state changes (debounced for performance)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    
    const timeoutId = setTimeout(() => {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - SESSION_STATE_CHANGED:`, {
        current_session: currentSession ? {
          id: currentSession.id,
          pdf_id: currentSession.pdf_id
        } : null,
        bookId,
        current_page: currentPage
      });
    }, 500); // Increased debounce time to reduce logging frequency
    
    return () => clearTimeout(timeoutId);
  }, [currentSession?.id, bookId, currentPage]); // Only track session ID changes, not the entire object

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
        setError(null); // Clear any previous errors
        
        const url = await pdfService.getBookPdfUrl(bookId);
        setPdfUrl(url);
        setBookTitle(`Book ${bookId}`);
        setInitialLoadComplete(true);
        console.log(`[PDF_VIEWER] ${new Date().toISOString()} - PDF_FETCH_SUCCESS:`, { bookId, url });
      } catch (err) {
        console.error(`[PDF_VIEWER] ${new Date().toISOString()} - PDF_FETCH_ERROR:`, { bookId, error: err });
        setError('Failed to load PDF. Please try again later.');
        setInitialLoadComplete(true);
        console.error('Error fetching PDF URL:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPdfUrl();
  }, [bookId]);
  
  // Memoized callback handlers to prevent re-renders
  const handleOpenHistory = useCallback(() => {
    setHistoryModalOpen(true);
  }, []);

  // Session control with notifications
  const handleStartSession = useCallback(async () => {
    try {
      await startSession();
      setSessionNotification({
        open: true,
        message: 'Reading session started! 📚',
        severity: 'success',
      });
    } catch (error) {
      setSessionNotification({
        open: true,
        message: 'Failed to start reading session',
        severity: 'error',
      });
    }
  }, [startSession]);

  const handleEndSession = useCallback(async () => {
    try {
      await endSession();
      setSessionNotification({
        open: true,
        message: `Session ended! 🎉`,
        severity: 'success',
      });
    } catch (error) {
      setSessionNotification({
        open: true,
        message: 'Failed to end reading session',
        severity: 'error',
      });
    }
  }, [endSession]);

  // Removed auto-start - user now controls session start manually

  // Listen for messages from the PDF.js iframe (for page changes and text selection)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return; // Ignore messages from other origins
      }

      const { data } = event;
      if (data && data.type === 'pagechange') {
        const newPage = data.page;
        if (newPage && newPage !== currentPage) {
          setCurrentPage(newPage);
        }
      }

      if (data && data.type === 'text-selected') {
        setSelection({ text: data.text, position: data.position });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [currentPage]);

  // beforeunload handling is now managed by the useReadingSession hook

  // Handle PDF night mode changes with improved timing and error handling
  useEffect(() => {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - NIGHT_MODE_CHANGED:`, { 
      pdfNightMode,
      bookId 
    });

    const applyNightMode = (iframe: HTMLIFrameElement, retryCount = 0): void => {
      try {
        const iframeDoc = iframe.contentDocument;
        const iframeWin = iframe.contentWindow;
        
        if (!iframeDoc || !iframeWin) {
          if (retryCount < 10) {
            setTimeout(() => applyNightMode(iframe, retryCount + 1), 200);
          }
          return;
        }

        const iframeBody = iframeDoc.body;
        
        if (pdfNightMode) {
          iframeBody.classList.add('pdf-night-mode');
          
          // Load night mode CSS if not already loaded
          if (!iframeDoc.querySelector('#pdf-night-mode-styles')) {
            const link = iframeDoc.createElement('link');
            link.id = 'pdf-night-mode-styles';
            link.rel = 'stylesheet';
            link.href = '/pdf-night-mode.css';
            link.onload = () => {
              console.log('[PDF_VIEWER] Night mode CSS loaded successfully');
              // Let CSS filters handle the night mode without forcing canvas re-draw
              // PDF.js will naturally update when user scrolls or navigates
            };
            link.onerror = () => {
              console.error('[PDF_VIEWER] Failed to load night mode CSS');
            };
            iframeDoc.head.appendChild(link);
          }
          // CSS already loaded, night mode class will apply filters automatically
        } else {
          iframeBody.classList.remove('pdf-night-mode');
          // CSS filters will be removed automatically, no need to force re-draw
        }
      } catch (error) {
        console.error('[PDF_VIEWER] Cross-origin error applying night mode:', error);
        if (retryCount < 5) {
          setTimeout(() => applyNightMode(iframe, retryCount + 1), 500);
        }
      }
    };

    const iframe = document.querySelector('iframe[title="PDF Viewer"]') as HTMLIFrameElement;
    if (iframe) {
      applyNightMode(iframe);
    } else {
      // Wait for iframe to load
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node instanceof HTMLIFrameElement && node.title === 'PDF Viewer') {
              observer.disconnect();
              // Wait for iframe content to load
              node.addEventListener('load', () => {
                setTimeout(() => applyNightMode(node), 500);
              });
              break;
            }
          }
        }
      });
      
      observer.observe(document.body, { childList: true, subtree: true });
      
      return () => observer.disconnect();
    }
  }, [pdfNightMode, bookId]);

  const handleBack = async () => {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - HANDLE_BACK_TRIGGERED:`, {
      has_current_session: !!currentSession,
      session_id: currentSession?.id
    });
    
    // End session before navigating if one is active
    if (currentSession) {
      console.log(`[PDF_VIEWER] ${new Date().toISOString()} - HANDLE_BACK_ENDING_SESSION_BEFORE_NAVIGATION`);
      try {
        await endSession();
      } catch (error) {
        console.error('Failed to end session before navigation:', error);
        // Continue navigation even if session end fails
      }
    }
    
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - HANDLE_BACK_NAVIGATING_TO_DASHBOARD`);
    navigate('/dashboard');
  };

  const handleSaveFlashcard = async (question: string, answer: string) => {
    if (!bookId || !selection) return;

    try {
      // This is a placeholder for the actual API call
      console.log('Saving flashcard:', {
        pdf_id: parseInt(bookId),
        question,
        answer,
        page_number: currentPage,
        context_text: selection.text,
      });
      
      // Here you would call your flashcard service:
      // await flashcardService.createManualFlashcard({ ... });

      setSessionNotification({
        open: true,
        message: 'Flashcard created successfully!',
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to create flashcard:', error);
      setSessionNotification({
        open: true,
        message: 'Failed to create flashcard.',
        severity: 'error',
      });
    } finally {
      setSelection(null); // Hide the button after saving
    }
  };

  // Debug loading condition
  const shouldShowLoading = loading || (!initialLoadComplete && !error && !pdfUrl);
  
  // Only log loading state changes in development
  if (import.meta.env.DEV) {
    console.log(`[PDF_VIEWER] ${new Date().toISOString()} - LOADING_CHECK:`, {
      bookId,
      loading,
      initialLoadComplete,
      error,
      hasPdfUrl: !!pdfUrl,
      shouldShowLoading,
      actualPdfUrl: pdfUrl
    });
  }

  if (shouldShowLoading) {
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
  // PDF.js handles last read page functionality and CMYK color management natively
  const viewerParams = new URLSearchParams({
    file: pdfUrl || ''
  });
  const viewerUrl = `/pdfjs-full/viewer.html?${viewerParams.toString()}`;
  
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
            onClick={handleEndSession}
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
            onClick={handleStartSession}
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
          onClick={handleOpenHistory}
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
          onLoad={() => setSelection(null)} // Clear selection when iframe reloads
        />

        {selection && (
          <Button
            variant="contained"
            size="small"
            sx={{
              position: 'absolute',
              top: `${selection.position.top + selection.position.height}px`,
              left: `${selection.position.left}px`,
              zIndex: 10,
            }}
            onClick={() => setIsFlashcardModalOpen(true)}
          >
            Create Flashcard
          </Button>
        )}

        {/* Enhanced Session Status Panel - Only show when session is active */}
        {currentSession && (
          <SessionStatusPanel
            currentSession={currentSession}
            currentPage={currentPage}
            totalPages={300} // This should come from PDF metadata
            onEndSession={handleEndSession}
            onOpenHistory={handleOpenHistory}
          />
        )}
      </Box>

      {/* Flashcard Creation Modal */}
      {selection && (
        <CreateFlashcardModal
          open={isFlashcardModalOpen}
          onClose={() => {
            setIsFlashcardModalOpen(false);
            setSelection(null); // Clear selection when modal is closed
          }}
          onSave={handleSaveFlashcard}
          contextText={selection.text}
          pageNumber={currentPage}
        />
      )}

      {/* Session History Modal */}
      <SessionHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        currentPdfId={currentSession?.pdf_id || 0}
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