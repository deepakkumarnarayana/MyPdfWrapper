import React from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  Avatar,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  MenuBook as BookIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { ProgressCard } from '../../ui/ProgressCard';
import { Book } from '../../../types/dashboard';

interface BooksSectionProps {
  books: Book[];
  isLoading?: boolean;
  error?: string | null;
  onBookSelect?: (bookId: string) => void;
  onUpload?: (file: File) => void;
  onRefresh?: () => void;
}

export const BooksSection: React.FC<BooksSectionProps> = ({ 
  books, 
  isLoading = false,
  error = null,
  onBookSelect,
  onUpload,
  onRefresh
}) => {

  const handleUploadClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file && onUpload) {
        onUpload(file);
      }
    };
    input.click();
  };

  if (error) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Alert severity="error" action={onRefresh && 
          <button onClick={onRefresh}>Retry</button>
        }>
          {error}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <BookIcon sx={{ mr: 1, color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Your Study Books ({books.length})
        </Typography>
        {isLoading && <CircularProgress size={20} sx={{ ml: 2 }} />}
      </Box>
      
      {isLoading && books.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {books.map((book) => (
            <ProgressCard 
              key={book.id}
              title={book.title}
              subtitle={book.pages}
              progress={book.progress}
              status={book.status}
              onClick={() => onBookSelect?.(book.id)}
            />
          ))}
          
          {books.length === 0 && !isLoading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No books uploaded yet. Start by uploading your first PDF!
              </Typography>
            </Box>
          )}
        </>
      )}
      
      {/* Upload New PDF Card */}
      <Paper 
        sx={{ 
          p: 4, 
          textAlign: 'center', 
          border: '2px dashed #e5e7eb',
          bgcolor: '#f9fafb',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: '#f3f4f6',
            borderColor: '#d1d5db',
          }
        }}
        onClick={handleUploadClick}
      >
        <Avatar sx={{ mx: 'auto', mb: 2, bgcolor: 'primary.main' }}>
          <UploadIcon />
        </Avatar>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          Upload New PDF
        </Typography>
      </Paper>
    </Paper>
  );
};