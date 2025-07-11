import React from 'react';
import {
  Paper,
  Typography,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { RecentSessionCard } from '../components/RecentSessionCard';
import { Session } from '../../../types/dashboard';

interface SessionsSectionProps {
  sessions: Session[];
  isLoading?: boolean;
  error?: string | null;
  onSessionView?: (sessionId: string) => void;
  onExportToAnki?: (sessionId: string) => void;
  onRefresh?: () => void;
}

export const SessionsSection: React.FC<SessionsSectionProps> = ({
  sessions,
  isLoading = false,
  error = null,
  onSessionView,
  onExportToAnki,
  onRefresh,
}) => {

  if (error) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error" action={onRefresh && 
          <button onClick={onRefresh}>Retry</button>
        }>
          {error}
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <TrendingIcon sx={{ mr: 1, color: 'info.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Recent Sessions ({sessions.length})
        </Typography>
        {isLoading && <CircularProgress size={20} sx={{ ml: 2 }} />}
      </Box>
      
      {isLoading && sessions.length === 0 ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {sessions.map((session) => (
            <RecentSessionCard 
              key={session.id} 
              title={session.title}
              pages={session.pages}
              duration={session.duration}
              hasCards={session.hasCards}
              onViewSession={() => onSessionView?.(session.id)}
              onExportToAnki={() => onExportToAnki?.(session.id)}
            />
          ))}
          
          {sessions.length === 0 && !isLoading && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No study sessions yet. Start reading a book to create your first session!
              </Typography>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
};