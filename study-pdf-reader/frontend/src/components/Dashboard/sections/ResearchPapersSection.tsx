import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Avatar,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Article as PaperIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { ProgressCard } from '../../ui/ProgressCard';
import { ResearchPaper } from '../../../types/dashboard';

interface ResearchPapersSectionProps {
  papers: ResearchPaper[];
  isLoading?: boolean;
  error?: string | null;
  onPaperSelect?: (paperId: string) => void;
  onUpload?: (file: File) => void;
  onRefresh?: () => void;
}

export const ResearchPapersSection: React.FC<ResearchPapersSectionProps> = ({
  papers,
  isLoading = false,
  error = null,
  onPaperSelect,
  onUpload,
  onRefresh,
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
          <button type="button" onClick={onRefresh}>Retry</button>
        }>
          {error}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <PaperIcon sx={{ mr: 1, color: 'info.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Research Papers ({papers.length})
        </Typography>
        {isLoading && <CircularProgress size={20} sx={{ ml: 2 }} />}
      </Box>
      
      {isLoading && papers.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {papers.map((paper) => (
            <ProgressCard 
              key={paper.id}
              title={paper.title}
              subtitle={paper.pages}
              progress={paper.progress}
              status={paper.status}
              onClick={() => onPaperSelect?.(paper.id)}
            />
          ))}
          
          {papers.length === 0 && !isLoading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No research papers uploaded yet. Upload your first research paper!
              </Typography>
            </Box>
          )}
        </>
      )}
      
      {/* Upload New Research Paper Card */}
      <Paper 
        sx={{ 
          p: 3, 
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
        <Avatar sx={{ mx: 'auto', mb: 1, bgcolor: 'info.main', width: 32, height: 32 }}>
          <UploadIcon sx={{ fontSize: 20 }} />
        </Avatar>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Upload Research Paper
        </Typography>
      </Paper>
    </Paper>
  );
};