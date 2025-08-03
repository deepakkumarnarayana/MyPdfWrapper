import React from 'react';
import { Box, Typography, Chip } from '@mui/material';

interface SystemStatusItemProps {
  service: string;
  status: 'Online' | 'Active' | 'Synced' | 'Offline' | 'Error';
  color: 'success' | 'info' | 'primary' | 'warning' | 'error';
}

export const SystemStatusItem: React.FC<SystemStatusItemProps> = ({ 
  service, 
  status, 
  color 
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
      <Typography variant="body2">{service}</Typography>
      <Chip label={status} color={color} size="small" />
    </Box>
  );
};