import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

// Direct mapping without any API calls or MSW interference
const bookFileMap: Record<string, string> = {
  'book-1': 'sample-ml-book.pdf',
  'book-2': 'operating-systems-book.pdf', 
  'book-3': 'multipage-sample.pdf',
  'book-4': 'CNSIA.pdf'
};

export const DirectPdfViewer: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (!bookId || !bookFileMap[bookId]) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">PDF not found for book ID: {bookId}</Typography>
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

  // Direct PDF path - no API, no MSW interference
  const pdfPath = `/sample-pdfs/${bookFileMap[bookId]}`;

  console.log(`[DIRECT PDF] Loading: ${pdfPath}`);

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
          PDF Viewer - {bookFileMap[bookId]}
        </Typography>
      </Box>

      {/* Direct PDF viewer - bypassing all MSW */}
      <Box sx={{ flexGrow: 1, position: 'relative', backgroundColor: 'white' }}>
        <embed
          src={pdfPath}
          type="application/pdf"
          style={{
            width: '100%',
            height: '100%',
            border: '1px solid #ccc',
          }}
        />
        
        {/* Success indicator */}
        <Box sx={{ 
          position: 'absolute', 
          top: 10, 
          right: 10, 
          backgroundColor: 'rgba(0,255,0,0.9)', 
          color: 'black', 
          padding: '8px 12px', 
          borderRadius: 1,
          fontSize: '14px',
          fontWeight: 'bold',
          zIndex: 1000,
          boxShadow: 2
        }}>
          ✓ Native PDF Loaded
        </Box>

        {/* Direct link for testing */}
        <Box sx={{ 
          position: 'absolute', 
          bottom: 10, 
          left: 10, 
          backgroundColor: 'rgba(0,0,0,0.8)', 
          color: 'white', 
          padding: '8px 12px', 
          borderRadius: 1,
          fontSize: '12px',
          zIndex: 1000
        }}>
          <a 
            href={pdfPath} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'lightblue', textDecoration: 'none' }}
          >
            Open in new tab →
          </a>
        </Box>
      </Box>
    </Box>
  );
};