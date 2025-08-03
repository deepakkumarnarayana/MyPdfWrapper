import React from 'react';
import {
  Paper,
  Typography,
  Stack,
  Button,
  Chip,
} from '@mui/material';

interface RecentSessionCardProps {
  title: string;
  pages: string;
  duration: string;
  hasCards: boolean;
  onViewSession?: () => void;
  onExportToAnki?: () => void;
}

export const RecentSessionCard: React.FC<RecentSessionCardProps> = ({
  title,
  pages,
  duration,
  hasCards,
  onViewSession,
  onExportToAnki,
}) => {
  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {pages} • {duration}
      </Typography>
      <Stack direction="row" spacing={1}>
        {hasCards && (
          <Chip label="Cards Generated" color="info" size="small" />
        )}
        <Button 
          size="small" 
          variant="outlined"
          onClick={onExportToAnki}
        >
          Save to Anki
        </Button>
        <Button 
          size="small" 
          variant="text"
          onClick={onViewSession}
        >
          View Session
        </Button>
      </Stack>
    </Paper>
  );
};