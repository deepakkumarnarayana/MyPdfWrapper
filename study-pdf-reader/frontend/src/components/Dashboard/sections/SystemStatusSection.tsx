import React from 'react';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { SystemStatusItem } from '../components/SystemStatusItem';
import { SystemService } from '../../../types/dashboard';

interface SystemStatusSectionProps {
  services: SystemService[];
  isLoading?: boolean;
  error?: string | null;
  onHealthCheck?: () => void;
  onRefresh?: () => void;
}

export const SystemStatusSection: React.FC<SystemStatusSectionProps> = ({
  services,
  isLoading = false,
  error = null,
  onRefresh,
}) => {

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error" action={onRefresh && 
          <button type="button" onClick={onRefresh}>Retry</button>
        }>
          {error}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          System Status
        </Typography>
        {isLoading && <CircularProgress size={20} />}
      </Box>
      
      {isLoading && services.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {services.map((service) => (
            <SystemStatusItem 
              key={service.id} 
              service={service.service}
              status={service.status}
              color={service.color}
            />
          ))}
          
          {services.length === 0 && !isLoading && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                No system services configured
              </Typography>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};