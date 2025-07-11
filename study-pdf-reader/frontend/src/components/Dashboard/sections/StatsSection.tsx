import React from 'react';
import { Grid, Box, CircularProgress, Alert } from '@mui/material';
import {
  Schedule as TimeIcon,
  Psychology as BrainIcon,
  School as SessionIcon,
  MenuBook as BookIcon,
} from '@mui/icons-material';
import { StatisticsCard } from '../../ui/StatisticsCard';
import { DashboardStats } from '../../../types/dashboard';

interface StatsSectionProps {
  stats: DashboardStats;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export const StatsSection: React.FC<StatsSectionProps> = ({ 
  stats,
  isLoading = false,
  error = null,
  onRefresh
}) => {

  if (error) {
    return (
      <Box sx={{ mb: 4 }}>
        <Alert severity="error" action={onRefresh && 
          <button type="button" onClick={onRefresh}>Retry</button>
        }>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Grid container spacing={3} sx={{ mb: 4 }}>
      <Grid item xs={12} sm={6} md={3}>
        <StatisticsCard
          title="Total Study Time"
          value={isLoading ? '...' : stats.totalTime}
          color="#6366f1"
          icon={isLoading ? <CircularProgress size={24} /> : <TimeIcon sx={{ fontSize: 40 }} />}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatisticsCard
          title="Cards Generated"
          value={isLoading ? '...' : stats.cardsGenerated}
          color="#10b981"
          icon={isLoading ? <CircularProgress size={24} /> : <BrainIcon sx={{ fontSize: 40 }} />}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatisticsCard
          title="Sessions Completed"
          value={isLoading ? '...' : stats.sessionsCompleted}
          color="#3b82f6"
          icon={isLoading ? <CircularProgress size={24} /> : <SessionIcon sx={{ fontSize: 40 }} />}
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <StatisticsCard
          title="Books Read"
          value={isLoading ? '...' : stats.booksRead}
          color="#f59e0b"
          icon={isLoading ? <CircularProgress size={24} /> : <BookIcon sx={{ fontSize: 40 }} />}
        />
      </Grid>
    </Grid>
  );
};