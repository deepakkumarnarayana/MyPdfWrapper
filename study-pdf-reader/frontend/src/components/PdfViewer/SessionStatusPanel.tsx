import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Collapse,
  LinearProgress,
  Button,
  Fade,
} from '@mui/material';
import {
  Timer as TimerIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  Stop as StopIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { ReadingSession } from '../../services/readingSession.service';

interface SessionStatusPanelProps {
  currentSession: ReadingSession | null;
  currentPage: number;
  totalPages?: number;
  onEndSession: () => void;
  onOpenHistory: () => void;
}

export const SessionStatusPanel: React.FC<SessionStatusPanelProps> = ({
  currentSession,
  currentPage,
  totalPages = 100,
  onEndSession,
  onOpenHistory,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [readingSpeed, setReadingSpeed] = useState(0);

  // Update session duration every second
  useEffect(() => {
    if (!currentSession) return;

    const interval = setInterval(() => {
      const startTime = new Date(currentSession.started_at);
      const now = new Date();
      const durationMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);
      setSessionDuration(durationMinutes);

      // Calculate reading speed (pages per minute)
      const pagesRead = Math.max(1, currentPage - (currentSession.start_page || 1) + 1);
      const speed = durationMinutes > 0 ? pagesRead / durationMinutes : 0;
      setReadingSpeed(speed);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentSession, currentPage]);

  const formatDuration = (minutes: number): string => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPagesRead = (): number => {
    if (!currentSession) return 0;
    return Math.max(0, currentPage - (currentSession.start_page || 1) + 1);
  };

  const getSessionProgress = (): number => {
    if (!currentSession || !totalPages) return 0;
    const startPage = currentSession.start_page || 1;
    const progress = ((currentPage - startPage + 1) / totalPages) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  if (!currentSession) {
    return null;
  }

  const pagesRead = getPagesRead();
  const sessionProgress = getSessionProgress();

  return (
    <Fade in={true}>
      <Card
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          minWidth: isExpanded ? 340 : 220,
          maxWidth: 380,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(76, 175, 80, 0.3)',
          borderRadius: 2,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          zIndex: 1000,
          '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderColor: 'rgba(76, 175, 80, 0.5)',
          },
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Collapsed State - Always Visible */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={
                <TimerIcon
                  sx={{
                    color: '#4CAF50',
                    animation: 'pulse 2s infinite',
                    '@keyframes pulse': {
                      '0%': { opacity: 1 },
                      '50%': { opacity: 0.7 },
                      '100%': { opacity: 1 },
                    },
                  }}
                />
              }
              label={formatDuration(sessionDuration)}
              size="small"
              sx={{
                backgroundColor: 'rgba(76, 175, 80, 0.15)',
                color: '#4CAF50',
                border: '1px solid rgba(76, 175, 80, 0.4)',
                fontWeight: 600,
                minWidth: 80,
              }}
            />
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
              <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                {pagesRead}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                pages
              </Typography>
            </Box>

            <IconButton
              onClick={() => setIsExpanded(!isExpanded)}
              size="small"
              sx={{
                color: 'rgba(255,255,255,0.7)',
                transition: 'transform 0.2s',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                '&:hover': {
                  color: 'white',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Box>

          {/* Expanded State */}
          <Collapse in={isExpanded}>
            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              {/* Reading Metrics */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SpeedIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Reading Speed
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                  {readingSpeed.toFixed(1)} pages/min
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Current Page
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                  {currentPage} of {totalPages}
                </Typography>
              </Box>

              {/* Progress Bar */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    Session Progress
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#4CAF50', fontWeight: 500 }}>
                    {sessionProgress.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={sessionProgress}
                  sx={{
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#4CAF50',
                      borderRadius: 3,
                    },
                  }}
                />
              </Box>

              {/* Quick Actions */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<HistoryIcon />}
                  onClick={onOpenHistory}
                  variant="outlined"
                  sx={{
                    color: 'white',
                    borderColor: 'rgba(255,255,255,0.3)',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.5)',
                      backgroundColor: 'rgba(255,255,255,0.05)',
                    },
                  }}
                >
                  History
                </Button>
                <Button
                  size="small"
                  startIcon={<StopIcon />}
                  onClick={onEndSession}
                  variant="outlined"
                  color="error"
                  sx={{
                    '&:hover': {
                      backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    },
                  }}
                >
                  End Session
                </Button>
              </Box>
            </Box>
          </Collapse>
        </CardContent>
      </Card>
    </Fade>
  );
};