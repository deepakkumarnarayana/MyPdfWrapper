import React from 'react';
import {
  Paper,
  Typography,
  Button,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
} from '@mui/icons-material';

interface QuickStartSectionProps {
  onStartSession?: () => void;
  onQuickUpload?: () => void;
}

export const QuickStartSection: React.FC<QuickStartSectionProps> = ({
  onStartSession,
}) => {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        Quick Start
      </Typography>
      <Button
        variant="contained"
        fullWidth
        size="large"
        startIcon={<StartIcon />}
        sx={{ mb: 2, py: 1.5 }}
        onClick={onStartSession}
      >
        Start Learning Session
      </Button>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
        Choose a random book and begin your active learning session with AI-powered flashcard generation.
      </Typography>
    </Paper>
  );
};