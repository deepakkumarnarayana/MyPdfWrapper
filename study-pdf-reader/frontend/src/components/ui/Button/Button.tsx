import React from 'react';
import { Button as MuiButton, ButtonProps as MuiButtonProps, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

// Extended props for our custom button
export interface ButtonProps extends Omit<MuiButtonProps, 'variant'> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

// Styled button with custom variants
const StyledButton = styled(MuiButton, {
  shouldForwardProp: (prop) => prop !== 'customVariant' && prop !== 'loading',
})<{ customVariant?: string }>(({ theme, customVariant }) => ({
  position: 'relative',
  textTransform: 'none',
  fontWeight: 500,
  borderRadius: theme.shape.borderRadius,
  transition: theme.transitions.create(['background-color', 'box-shadow', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
  
  // Custom variants
  ...(customVariant === 'primary' && {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.dark,
      transform: 'translateY(-1px)',
      boxShadow: theme.shadows[4],
    },
  }),
  
  ...(customVariant === 'secondary' && {
    backgroundColor: theme.palette.grey[200],
    color: theme.palette.grey[700],
    border: `1px solid ${theme.palette.grey[300]}`,
    '&:hover': {
      backgroundColor: theme.palette.grey[300],
    },
  }),
  
  ...(customVariant === 'danger' && {
    backgroundColor: theme.palette.error.main,
    color: theme.palette.error.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.error.dark,
    },
  }),
  
  ...(customVariant === 'ghost' && {
    backgroundColor: 'transparent',
    color: theme.palette.primary.main,
    border: `1px solid ${theme.palette.primary.main}`,
    '&:hover': {
      backgroundColor: theme.palette.primary.main + '10',
    },
  }),
  
  // Loading styles handled by ButtonContent component
}));

const ButtonContent = styled('span')<{ loading?: boolean }>(({ loading }) => ({
  display: 'flex',
  alignItems: 'center',
  opacity: loading ? 0.7 : 1,
}));

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  ...props
}) => {
  return (
    <StyledButton
      {...props}
      variant="contained"
      customVariant={variant}
      disabled={disabled || loading}
      fullWidth={fullWidth}
      startIcon={loading ? <CircularProgress size={16} color="inherit" /> : icon}
    >
      <ButtonContent loading={loading}>
        {children}
      </ButtonContent>
    </StyledButton>
  );
};
