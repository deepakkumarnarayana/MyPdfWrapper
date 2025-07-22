import { ZoomOption } from './types';

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

export const HIGHLIGHT_COLORS = [
  '#FFFF00', '#00FF00', '#FF0000', '#0000FF', '#FF00FF', '#00FFFF', '#FFA500'
];

export const RENDER_CONFIG = {
  MAX_CONCURRENT_RENDERS: 2,
  QUEUE_DELAY: 10,
  CANCELLATION_DELAY: 10,
  HIGHLIGHT_APPLY_DELAY: 50,
  INITIAL_RENDER_COUNT: 3,
  INTERSECTION_ROOT_MARGIN: '100px',
  INTERSECTION_THRESHOLDS: [0.1, 0.3, 0.5],
};

