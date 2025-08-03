import { createTheme, ThemeOptions } from '@mui/material/styles';
import { palette } from './palette';
import { typography } from './typography';
import { components } from './components';

const themeOptions: ThemeOptions = {
  palette,
  typography,
  components,
  spacing: 8,
  shape: {
    borderRadius: 8,
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920,
    },
  },
};

export const theme = createTheme(themeOptions);

// Theme type augmentation for custom properties
declare module '@mui/material/styles' {
  interface Theme {
    custom: {
      sidebar: {
        width: number;
        collapsedWidth: number;
      };
      header: {
        height: number;
      };
      shadows: {
        card: string;
        hover: string;
      };
    };
  }

  interface ThemeOptions {
    custom?: {
      sidebar?: {
        width?: number;
        collapsedWidth?: number;
      };
      header?: {
        height?: number;
      };
      shadows?: {
        card?: string;
        hover?: string;
      };
    };
  }
}

// Add custom properties to theme
export const customTheme = createTheme({
  ...themeOptions,
  custom: {
    sidebar: {
      width: 280,
      collapsedWidth: 64,
    },
    header: {
      height: 64,
    },
    shadows: {
      card: '0 2px 8px rgba(0, 0, 0, 0.1)',
      hover: '0 8px 24px rgba(0, 0, 0, 0.15)',
    },
  },
});
