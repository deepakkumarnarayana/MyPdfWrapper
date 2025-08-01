// Export the full PDF.js viewer with all features (highlighting, search, sidebar, etc.)
export { FullPdfViewer as PdfViewer } from './FullPdfViewer';

// Export types for external use
export type { 
  PageRenderInfo, 
  Highlight, 
  ContextMenuState, 
  ZoomOption, 
  PdfRenderConfig 
} from './types';

// Export constants for external use
export { 
  ZOOM_OPTIONS, 
  HIGHLIGHT_COLORS, 
  RENDER_CONFIG
} from './constants';

// Export hooks for potential reuse
export { useHighlights } from './hooks/useHighlights';
export { usePdfLoader } from './hooks/usePdfLoader';
export { usePdfContextMenu } from './hooks/usePdfContextMenu';
export { useTableOfContents } from './hooks/useTableOfContents';