import { ZoomOption, HighlightColor, HighlightSettings } from './types';

export const ZOOM_OPTIONS: ZoomOption[] = [
  { value: '25', label: '25%' },
  { value: '50', label: '50%' },
  { value: '75', label: '75%' },
  { value: '100', label: '100%' },
  { value: '120', label: '120%' },
  { value: '125', label: '125%' },
  { value: '150', label: '150%' },
  { value: '200', label: '200%' },
  { value: '300', label: '300%' },
  { value: '400', label: '400%' },
  { value: 'auto', label: 'Fit Width' },
  { value: 'page-fit', label: 'Fit Page' },
];

// Legacy colors for backward compatibility
export const HIGHLIGHT_COLORS = [
  '#FFFF00', '#00FF00', '#FF0000', '#0000FF', '#FF00FF', '#00FFFF', '#FFA500'
];

// Enhanced highlight colors based on PDF.js implementation
export const HIGHLIGHT_COLOR_OPTIONS: HighlightColor[] = [
  { name: 'yellow', value: '#FFFF00', displayName: 'Yellow' },
  { name: 'green', value: '#00FF7F', displayName: 'Green' },
  { name: 'cyan', value: '#00FFFF', displayName: 'Cyan' },
  { name: 'pink', value: '#FFB6C1', displayName: 'Pink' },
  { name: 'red', value: '#FF6B6B', displayName: 'Red' },
];

export const DEFAULT_HIGHLIGHT_SETTINGS: HighlightSettings = {
  selectedColor: '#FFFF00',
  thickness: 12,
  opacity: 1,
  showAll: true,
  defaultColors: HIGHLIGHT_COLOR_OPTIONS,
};

export const HIGHLIGHT_CONFIG = {
  DEFAULT_THICKNESS: 12,
  MIN_THICKNESS: 1,
  MAX_THICKNESS: 24,
  DEFAULT_OPACITY: 1,
  MIN_OPACITY: 0.1,
  MAX_OPACITY: 1,
};

export const RENDER_CONFIG = {
  MAX_CONCURRENT_RENDERS: 2,
  QUEUE_DELAY: 10,
  CANCELLATION_DELAY: 10,
  HIGHLIGHT_APPLY_DELAY: 50,
  INITIAL_RENDER_COUNT: 3,
  INTERSECTION_ROOT_MARGIN: '100px',
  INTERSECTION_THRESHOLDS: [0.1, 0.3, 0.5],
};

