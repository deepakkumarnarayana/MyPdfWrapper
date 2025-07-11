import React from 'react';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { AIProviderItem } from '../components/AIProviderItem';
import { AIProvider } from '../../../types/dashboard';

interface AIProvidersSectionProps {
  providers: AIProvider[];
  isLoading?: boolean;
  error?: string | null;
  onProviderSelect?: (providerId: string) => void;
  onRefresh?: () => void;
}

export const AIProvidersSection: React.FC<AIProvidersSectionProps> = ({
  providers,
  isLoading = false,
  error = null,
  onProviderSelect,
  onRefresh,
}) => {

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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          AI Providers
        </Typography>
        {isLoading && <CircularProgress size={20} />}
      </Box>
      
      {isLoading && providers.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {providers.map((provider) => (
            <AIProviderItem 
              key={provider.id} 
              name={provider.name}
              lastUsed={provider.lastUsed}
              status={provider.status}
              onClick={() => onProviderSelect?.(provider.id)}
            />
          ))}
          
          {providers.length === 0 && !isLoading && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No AI providers configured
              </Typography>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};