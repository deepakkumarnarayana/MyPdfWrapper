import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
} from '@mui/material';

export interface StatisticsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
}

export const StatisticsCard: React.FC <StatisticsCardProps> = ({
  title,
  value,
  icon,
  color = '#6366f1',
}) => {
  return (
    <Card sx={{ height: '100%', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      <CardContent sx={{ textAlign: 'center', py: 3 }}>
        {icon && (
          <Box sx={{ color, mb: 1 }}>{icon}</Box>
        )}
        <Typography 
          variant="h3" 
          component="div" 
          sx={{ fontWeight: 700, color, mb: 1 }}
        >
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
      </CardContent>
    </Card>
  );
};