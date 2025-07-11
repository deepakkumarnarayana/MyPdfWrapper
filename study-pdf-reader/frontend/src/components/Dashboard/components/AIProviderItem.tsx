import React from 'react';
import { Box, Typography } from '@mui/material';

interface AIProviderItemProps {
  name: string;
  lastUsed: string;
  status: 'online' | 'offline';
  onClick?: () => void;
}

export const AIProviderItem: React.FC<AIProviderItemProps> = ({ 
  name, 
  lastUsed, 
  status,
  onClick
}) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        py: 1,
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { bgcolor: 'grey.50' } : {}
      }}
      onClick={onClick}
    >
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Last used: {lastUsed}
        </Typography>
      </Box>
      <Box 
        sx={{ 
          width: 8, 
          height: 8, 
          borderRadius: '50%', 
          bgcolor: status === 'online' ? 'success.main' : 'error.main' 
        }} 
      />
    </Box>
  );
};