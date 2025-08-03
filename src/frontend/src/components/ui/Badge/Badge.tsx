import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { styled } from '@mui/material/styles';

export interface BadgeProps extends Omit<ChipProps, 'variant'> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'small' | 'medium';
}

const StyledChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'badgeVariant',
})<{ badgeVariant?: string }>(({ theme, badgeVariant }) => ({
  fontWeight: 500,
  
  ...(badgeVariant === 'success' && {
    backgroundColor: theme.palette.success.main,
    color: theme.palette.success.contrastText,
  }),
  
  ...(badgeVariant === 'warning' && {
    backgroundColor: theme.palette.warning.main,
    color: theme.palette.warning.contrastText,
  }),
  
  ...(badgeVariant === 'danger' && {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
  }),
  
  ...(badgeVariant === 'info' && {
    backgroundColor: theme.palette.info.main,
    color: theme.palette.info.contrastText,
  }),
}));

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'medium',
  ...props
}) => {
  return (
    <StyledChip
      badgeVariant={variant}
      size={size}
      {...props}
    />
  );
};