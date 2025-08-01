import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
  Grid,
  LinearProgress,
} from '@mui/material';
import {
  AccessTime as AccessTimeIcon,
  MenuBook as MenuBookIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingUpIcon,
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
} from '@mui/icons-material';
import { ReadingSession, readingSessionService } from '../../services/readingSession.service';

interface SessionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  currentPdfId?: number;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ marginTop: 16 }}>
    {value === index && children}
  </div>
);

export const SessionHistoryModal: React.FC<SessionHistoryModalProps> = ({
  open,
  onClose,
  currentPdfId,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [sessions, setSessions] = useState<ReadingSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadSessionHistory();
    }
  }, [open, currentPdfId]);

  const loadSessionHistory = async () => {
    setLoading(true);
    try {
      let sessionData: ReadingSession[];
      if (currentPdfId && activeTab === 0) {
        // Current PDF sessions
        sessionData = await readingSessionService.getSessionsForPdf(currentPdfId);
      } else {
        // All recent sessions
        sessionData = await readingSessionService.getRecentSessions(20);
      }
      setSessions(sessionData);
    } catch (error) {
      console.error('Failed to load session history:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    const hrs = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatDate = (dateString: string): string => {
    // Standard approach - backend sends proper ISO 8601 format
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return 'Today';
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      // Display in user's local timezone
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  const calculateReadingSpeed = (session: ReadingSession): number => {
    if (!session.ended_at || session.total_time_minutes === 0) return 0;
    return session.pages_read / session.total_time_minutes;
  };

  const getSessionStats = () => {
    const completedSessions = sessions.filter(s => s.ended_at);
    
    const totalTime = completedSessions.reduce((sum, s) => sum + s.total_time_minutes, 0);
    const totalPages = completedSessions.reduce((sum, s) => sum + s.pages_read, 0);
    const avgSpeed = completedSessions.length > 0 
      ? completedSessions.reduce((sum, s) => sum + calculateReadingSpeed(s), 0) / completedSessions.length
      : 0;
    
    return {
      totalSessions: completedSessions.length,
      totalTime,
      totalPages,
      avgSpeed,
    };
  };

  const stats = getSessionStats();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: '#1e1e1e',
          color: 'white',
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Reading Analytics</Typography>
          <Button
            onClick={onClose}
            color="inherit"
            startIcon={<CloseIcon />}
            sx={{ minWidth: 'auto', p: 1 }}
          >
          </Button>
        </Box>
        
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          sx={{
            mt: 2,
            '& .MuiTab-root': { color: 'rgba(255,255,255,0.7)' },
            '& .Mui-selected': { color: '#4CAF50' },
            '& .MuiTabs-indicator': { backgroundColor: '#4CAF50' },
          }}
        >
          <Tab label="Current PDF" />
          <Tab label="All Sessions" />
          <Tab label="Statistics" />
        </Tabs>
      </DialogTitle>

      <DialogContent>
        {/* Current PDF Sessions */}
        <TabPanel value={activeTab} index={0}>
          <Typography variant="subtitle1" sx={{ mb: 2, color: '#4CAF50' }}>
            Sessions for this PDF
          </Typography>
          {loading ? (
            <LinearProgress />
          ) : sessions.length === 0 ? (
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center', py: 4 }}>
              No sessions found for this PDF
            </Typography>
          ) : (
            <List>
              {sessions.map((session, index) => (
                <React.Fragment key={session.id}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <MenuBookIcon sx={{ color: '#4CAF50' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body1">
                            {formatDate(session.started_at)}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                              icon={<AccessTimeIcon />}
                              label={formatDuration(session.total_time_minutes)}
                              size="small"
                              sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50' }}
                            />
                            <Chip
                              icon={<MenuBookIcon />}
                              label={`${session.pages_read} pages`}
                              size="small"
                              variant="outlined"
                              sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
                            />
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Pages {session.start_page} - {session.end_page || 'In Progress'} • 
                          Speed: {calculateReadingSpeed(session).toFixed(1)} pages/min
                        </Typography>
                      }
                    />
                  </ListItem>
                  {index < sessions.length - 1 && <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />}
                </React.Fragment>
              ))}
            </List>
          )}
        </TabPanel>

        {/* All Sessions */}
        <TabPanel value={activeTab} index={1}>
          <Typography variant="subtitle1" sx={{ mb: 2, color: '#4CAF50' }}>
            Recent Reading Sessions
          </Typography>
          {loading ? (
            <LinearProgress />
          ) : (
            <List>
              {sessions.slice(0, 10).map((session, index) => (
                <React.Fragment key={session.id}>
                  <ListItem sx={{ px: 0 }}>
                    <ListItemIcon>
                      <CalendarIcon sx={{ color: 'rgba(255,255,255,0.7)' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body1">
                          PDF ID: {session.pdf_id} • {formatDate(session.started_at)}
                        </Typography>
                      }
                      secondary={
                        <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          <Chip
                            label={formatDuration(session.total_time_minutes)}
                            size="small"
                            sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4CAF50' }}
                          />
                          <Chip
                            label={`${session.pages_read} pages`}
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
                          />
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < Math.min(sessions.length, 10) - 1 && 
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />}
                </React.Fragment>
              ))}
            </List>
          )}
        </TabPanel>

        {/* Statistics */}
        <TabPanel value={activeTab} index={2}>
          <Typography variant="subtitle1" sx={{ mb: 3, color: '#4CAF50' }}>
            Reading Statistics
          </Typography>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Card sx={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', border: '1px solid rgba(76, 175, 80, 0.3)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <MenuBookIcon sx={{ color: '#4CAF50', fontSize: 32 }} />
                    <Box>
                      <Typography variant="h4" sx={{ color: '#4CAF50', fontWeight: 'bold' }}>
                        {stats.totalSessions}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Total Sessions
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Card sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', border: '1px solid rgba(33, 150, 243, 0.3)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <AccessTimeIcon sx={{ color: '#2196F3', fontSize: 32 }} />
                    <Box>
                      <Typography variant="h4" sx={{ color: '#2196F3', fontWeight: 'bold' }}>
                        {formatDuration(stats.totalTime)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Total Time
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Card sx={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', border: '1px solid rgba(255, 152, 0, 0.3)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <TrendingUpIcon sx={{ color: '#FF9800', fontSize: 32 }} />
                    <Box>
                      <Typography variant="h4" sx={{ color: '#FF9800', fontWeight: 'bold' }}>
                        {stats.totalPages}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Pages Read
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Card sx={{ backgroundColor: 'rgba(156, 39, 176, 0.1)', border: '1px solid rgba(156, 39, 176, 0.3)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <SpeedIcon sx={{ color: '#9C27B0', fontSize: 32 }} />
                    <Box>
                      <Typography variant="h4" sx={{ color: '#9C27B0', fontWeight: 'bold' }}>
                        {stats.avgSpeed.toFixed(1)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Avg Speed (pages/min)
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="contained" sx={{ backgroundColor: '#4CAF50' }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};