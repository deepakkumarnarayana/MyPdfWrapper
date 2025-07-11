import React from 'react';
import {
  Paper,
  Typography,
  LinearProgress,
  Chip,
  Box,
} from '@mui/material';

export interface ProgressCardProps {
  title: string;
  subtitle: string;
  progress: number;
  status: 'In Progress' | 'Started' | 'Completed';
  onClick?: () => void;
}

export const ProgressCard: React.FC<ProgressCardProps> = ({
  title,
  subtitle,
  progress,
  status,
  onClick,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'In Progress': return 'primary';
      case 'Started': return 'warning';
      case 'Completed': return 'success';
      default: return 'default';
    }
  };

  return (
    <Paper 
      sx={{ 
        p: 3, 
        mb: 2,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? {
          boxShadow: (theme) => theme.shadows[4],
        } : {},
      }}
      onClick={onClick}
    >
      <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {subtitle}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Chip 
          label={status} 
          color={getStatusColor(status) as 'primary' | 'warning' | 'success' | 'default'}
          size="small"
        />
        <Box sx={{ flexGrow: 1 }}>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {progress}%
        </Typography>
      </Box>
    </Paper>
  );
};