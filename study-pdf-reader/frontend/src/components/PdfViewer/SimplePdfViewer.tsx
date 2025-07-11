import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  ArrowBack,
  OpenInNew,
  Download,
  Fullscreen,
} from '@mui/icons-material';

interface SimplePdfViewerProps {}

export const SimplePdfViewer: React.FC<SimplePdfViewerProps> = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'info' | 'warning' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'info',
  });

  // Load PDF URL
  useEffect(() => {
    if (!bookId) return;

    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch PDF from API endpoint
        const url = `/api/books/${bookId}/pdf`;
        setPdfUrl(url);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF. Please check if the PDF file exists and try again.');
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [bookId]);

  // Handle back navigation
  const handleBack = () => {
    navigate('/dashboard');
  };

  // Handle download
  const handleDownload = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `book-${bookId}.pdf`;
      link.click();
      setSnackbar({
        open: true,
        message: 'PDF download started!',
        severity: 'success',
      });
    }
  };

  // Handle open in new tab
  const handleOpenInNewTab = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      setSnackbar({
        open: true,
        message: 'PDF opened in new tab!',
        severity: 'info',
      });
    }
  };

  // Handle fullscreen
  const handleFullscreen = () => {
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.requestFullscreen) {
      iframe.requestFullscreen();
    }
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          Loading PDF...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <IconButton onClick={handleBack} color="primary">
          <ArrowBack />
          <Typography variant="body2" sx={{ ml: 1 }}>
            Back to Dashboard
          </Typography>
        </IconButton>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* App Bar */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            PDF Reader - Book {bookId}
          </Typography>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Download PDF">
              <IconButton color="inherit" onClick={handleDownload}>
                <Download />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Open in New Tab">
              <IconButton color="inherit" onClick={handleOpenInNewTab}>
                <OpenInNew />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Fullscreen">
              <IconButton color="inherit" onClick={handleFullscreen}>
                <Fullscreen />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>

      {/* PDF Content */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f5f5f5',
          p: 2,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            width: '100%',
            height: '100%',
            maxWidth: '1200px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {pdfUrl && (
            <iframe
              src={pdfUrl}
              width="100%"
              height="100%"
              style={{
                border: 'none',
                borderRadius: '8px',
              }}
              title={`PDF Viewer - Book ${bookId}`}
            />
          )}
        </Paper>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};