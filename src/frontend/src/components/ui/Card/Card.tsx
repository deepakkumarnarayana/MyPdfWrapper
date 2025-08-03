import React from 'react';
import { Card as MuiCard, CardContent, CardProps as MuiCardProps } from '@mui/material';
import { styled } from '@mui/material/styles';

export interface CardProps extends Omit<MuiCardProps, 'children'> {
  children: React.ReactNode;
  hoverable?: boolean;
  padding?: 'small' | 'medium' | 'large';
}

const StyledCard = styled(MuiCard, {
  shouldForwardProp: (prop) => prop !== 'hoverable' && prop !== 'padding',
})<{ hoverable?: boolean; padding?: string }>(({ theme, hoverable, padding = 'medium' }) => ({
  transition: theme.transitions.create(['box-shadow', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
  
  ...(hoverable && {
    cursor: 'pointer',
    '&:hover': {
      boxShadow: theme.shadows[8],
      transform: 'translateY(-2px)',
    },
  }),
  
  '& .MuiCardContent-root': {
    ...(padding === 'small' && {
      padding: theme.spacing(1),
      '&:last-child': {
        paddingBottom: theme.spacing(1),
      },
    }),
    ...(padding === 'medium' && {
      padding: theme.spacing(2),
      '&:last-child': {
        paddingBottom: theme.spacing(2),
      },
    }),
    ...(padding === 'large' && {
      padding: theme.spacing(3),
      '&:last-child': {
        paddingBottom: theme.spacing(3),
      },
    }),
  },
}));

export const Card: React.FC<CardProps> = ({
  children,
  hoverable = false,
  padding = 'medium',
  onClick,
  ...props
}) => {
  return (
    <StyledCard
      hoverable={hoverable}
      padding={padding}
      onClick={onClick}
      {...props}
    >
      <CardContent>
        {children}
      </CardContent>
    </StyledCard>
  );
};