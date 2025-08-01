import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

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

  const handleBack = () => {
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
        <Typography variant="h6" sx={{ color: 'white' }}>
          {bookPdfMap[bookId]} - Full PDF.js Viewer (All Features)
        </Typography>
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