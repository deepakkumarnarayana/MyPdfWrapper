/**
 * PDF Viewer Module - Production Exports
 * 
 * This module exports the ACTIVE PDF viewer implementation used in production.
 * 
 * Current active implementation: FullPdfViewer
 * - Complete study application with session tracking
 * - Flashcard creation, night mode, progress tracking
 * - Full integration with backend API services
 * - Used in route: /pdf/:bookId
 * 
 * Note: Other PDF viewer files in this directory are DEPRECATED and marked for removal.
 * They have @deprecated comments and should not be used.
 */

// Export the production-ready PDF viewer with complete feature set
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