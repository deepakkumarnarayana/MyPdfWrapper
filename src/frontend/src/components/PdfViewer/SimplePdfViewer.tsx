import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Alert } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { apiService } from '../../services/ApiService';

export const SimplePdfViewer: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const addDebugLog = (message: string) => {
    console.log(`[PDF DEBUG] ${message}`);
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  useEffect(() => {
    addDebugLog(`Component mounted with bookId: ${bookId}`);
    
    if (!bookId) {
      addDebugLog('No bookId provided in URL params');
      return;
    }

    const pdfUrl = `/api/books/${bookId}/pdf`;
    addDebugLog(`PDF URL constructed: ${pdfUrl}`);
    
    // Also test direct access to the PDF file (for fallback scenarios)
    const directPdfUrls = [
      `/sample-pdfs/CNSIA.pdf`,
      `/sample-pdfs/sample-ml-book.pdf`,
      `/sample-pdfs/operating-systems-book.pdf`,
      `/sample-pdfs/multipage-sample.pdf`
    ];
    
    // Get the book filename for direct access testing
    const bookFileMap: Record<string, string> = {
      'book-1': 'sample-ml-book.pdf',
      'book-2': 'operating-systems-book.pdf', 
      'book-3': 'multipage-sample.pdf',
      'book-4': 'CNSIA.pdf'
    };
    
    const directPdfUrl = `/sample-pdfs/${bookFileMap[bookId] || 'CNSIA.pdf'}`;
    addDebugLog(`Direct PDF URL for testing: ${directPdfUrl}`);

    // Test if PDF URL is accessible via API using centralized ApiService
    const testPdfAccess = async () => {
      try {
        const response = await apiService.head(pdfUrl);
        addDebugLog(`PDF HEAD request status: ${response.status}`);
        
        if (response.status === 200) {
          addDebugLog('PDF HEAD request successful - PDF is accessible via API');
        } else {
          setPdfError(`PDF not accessible via API: ${response.status} ${response.statusText}`);
          addDebugLog(`PDF HEAD request failed: ${response.status}`);
          
          // Try direct access as fallback using native fetch (for static files outside API)
          try {
            addDebugLog(`Trying direct PDF access: ${directPdfUrl}`);
            const directResponse = await fetch(directPdfUrl, { method: 'HEAD' });
            addDebugLog(`Direct PDF access status: ${directResponse.status}`);
            
            if (directResponse.ok) {
              addDebugLog('Direct PDF access successful - can use fallback mode');
              setPdfError('API access failed, but direct PDF access works');
            }
          } catch (directError) {
            addDebugLog(`Direct PDF access error: ${directError.message}`);
          }
        }
      } catch (error: any) {
        addDebugLog(`PDF HEAD request error: ${error.message}`);
        setPdfError(`Network error: ${error.message}`);
        
        // Still try direct access as last resort
        try {
          addDebugLog(`Trying direct PDF access as fallback: ${directPdfUrl}`);
          const directResponse = await fetch(directPdfUrl, { method: 'HEAD' });
          if (directResponse.ok) {
            addDebugLog('Direct PDF access successful - can use fallback mode');
            setPdfError('API access failed, but direct PDF access works');
          }
        } catch (directError) {
          addDebugLog(`Direct PDF access also failed: ${directError.message}`);
        }
      }
    };
    
    testPdfAccess();
  }, [bookId]);

  if (!bookId) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">No book ID provided</Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={handleBack}
          sx={{ mt: 2 }}
        >
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  // Determine which PDF URL to use
  const bookFileMap: Record<string, string> = {
    'book-1': 'sample-ml-book.pdf',
    'book-2': 'operating-systems-book.pdf', 
    'book-3': 'multipage-sample.pdf',
    'book-4': 'CNSIA.pdf'
  };
  
  const apiPdfUrl = `/api/books/${bookId}/pdf`;
  const directPdfUrl = `/sample-pdfs/${bookFileMap[bookId] || 'CNSIA.pdf'}`;
  
  // Use API URL first, with direct URL as fallback
  const pdfUrl = apiPdfUrl;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#525659' }}>
      {/* Simple header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        backgroundColor: '#404040',
        display: 'flex',
        alignItems: 'center',
        gap: 2
      }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBack />}
          onClick={handleBack}
          sx={{ color: 'white', borderColor: 'white' }}
        >
          Back
        </Button>
        <Typography variant="h6" sx={{ color: 'white' }}>
          PDF Viewer - Book {bookId}
        </Typography>
      </Box>

      {/* Debug information */}
      {debugInfo.length > 0 && (
        <Box sx={{ p: 2, backgroundColor: '#333', color: 'white', maxHeight: '200px', overflow: 'auto' }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Debug Log:</Typography>
          {debugInfo.map((log, index) => (
            <Typography key={index} variant="caption" sx={{ display: 'block', fontFamily: 'monospace' }}>
              {log}
            </Typography>
          ))}
        </Box>
      )}

      {/* Error display */}
      {pdfError && (
        <Alert severity="warning" sx={{ m: 2 }}>
          <Box>
            <Typography variant="subtitle2">API Access Issue:</Typography>
            <Typography variant="caption">{pdfError}</Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
              Trying alternative access methods...
            </Typography>
          </Box>
        </Alert>
      )}

      {/* Simple PDF embed using browser's native PDF viewer */}
      <Box sx={{ flexGrow: 1, position: 'relative' }}>
        {/* Primary embed using API URL */}
        <embed
          src={pdfUrl}
          type="application/pdf"
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          onLoad={() => addDebugLog('PDF embed loaded successfully via API')}
          onError={() => {
            addDebugLog('PDF embed failed to load via API');
          }}
        />
        
        {/* Fallback iframe using API URL */}
        <iframe
          src={pdfUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            zIndex: -1,
          }}
          onLoad={() => addDebugLog('PDF iframe loaded as fallback via API')}
          onError={() => addDebugLog('PDF iframe failed to load via API')}
          title="PDF API Fallback"
        />
        
        {/* Direct PDF access fallback (last resort) */}
        <iframe
          src={directPdfUrl}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            zIndex: -2,
          }}
          onLoad={() => addDebugLog('PDF iframe loaded via direct access')}
          onError={() => addDebugLog('PDF iframe failed to load via direct access')}
          title="PDF Direct Fallback"
        />
      </Box>
      
      {/* Quick test buttons for debugging */}
      <Box sx={{ p: 2, backgroundColor: '#404040', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <a 
          href={apiPdfUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: 'white', textDecoration: 'underline', fontSize: '12px' }}
        >
          Test API URL
        </a>
        <a 
          href={directPdfUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ color: 'white', textDecoration: 'underline', fontSize: '12px' }}
        >
          Test Direct URL
        </a>
        <Typography variant="caption" sx={{ color: 'white' }}>
          API: {apiPdfUrl} | Direct: {directPdfUrl}
        </Typography>
      </Box>
    </Box>
  );
};