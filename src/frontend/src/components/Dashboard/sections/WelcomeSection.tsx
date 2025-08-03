import React from 'react';
import { Box, Typography } from '@mui/material';

interface WelcomeSectionProps {
  user?: {
    name?: string;
  } | null;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({ user }) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Welcome back, {user?.name || 'John Doe'}! 👋
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Continue your learning journey with AI-powered PDF study tools.
      </Typography>
    </Box>
  );
};