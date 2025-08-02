import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import { 
  DarkMode as DarkModeIcon, 
  LightMode as LightModeIcon 
} from '@mui/icons-material';
import { useUI } from '../../store';

interface NightModeToggleProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'inherit' | 'default' | 'primary' | 'secondary';
}

export const NightModeToggle: React.FC<NightModeToggleProps> = ({ 
  size = 'medium',
  color = 'inherit'
}) => {
  const { pdfNightMode, togglePdfNightMode } = useUI();

  const handleToggle = () => {
    togglePdfNightMode();
  };

  return (
    <Tooltip 
      title={pdfNightMode ? 'Switch to Light Mode' : 'Switch to Night Mode'}
      arrow
    >
      <IconButton
        onClick={handleToggle}
        size={size}
        color={color}
        sx={{
          color: color === 'inherit' ? 'white' : undefined,
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        {pdfNightMode ? <LightModeIcon /> : <DarkModeIcon />}
      </IconButton>
    </Tooltip>
  );
};