# PDF Viewer Component - Refactored Architecture

This directory contains a refactored and optimized PDF viewer component with improved maintainability, reusability, and performance.

## Architecture Overview

The PDF viewer has been broken down into smaller, focused components and custom hooks following React best practices.

### 📁 Directory Structure

```
PdfViewer/
├── components/
│   ├── PdfContextMenu.tsx      # Context menu for text selection and highlights
│   ├── PdfToolbar.tsx          # PDF navigation and control toolbar
│   └── TableOfContentsDrawer.tsx # TOC sidebar component
├── hooks/
│   ├── useHighlights.ts        # Highlighting functionality
│   ├── usePdfContextMenu.ts    # Context menu state management
│   ├── usePdfLoader.ts         # PDF document loading
│   └── useTableOfContents.ts   # TOC extraction and management
├── styles/
│   └── PdfTextLayer.css        # PDF text layer styling
├── constants.ts                # Shared constants and configurations
├── types.ts                    # TypeScript type definitions
├── PdfViewerFixed.tsx          # Main PDF viewer component (optimized and debugged)
└── index.ts                   # Public API exports
```

## 🔧 Components

### Main Component: `PdfViewer`
The main PDF viewer component that orchestrates all functionality using custom hooks.

**Key Features:**
- Responsive PDF rendering with zoom and rotation
- Text selection and highlighting
- Table of contents navigation
- Dark mode support
- Optimized performance with intersection observer

### Sub-components

#### `PdfContextMenu`
Handles right-click context menus for text selection and highlight management.

#### `PdfToolbar`
Contains all PDF navigation controls, zoom options, and settings.

#### `TableOfContentsDrawer`
Sidebar component for PDF outline navigation.

## 🎣 Custom Hooks

### `usePdfLoader`
Manages PDF document loading and error handling.

```typescript
const { pdfDoc, totalPages, isLoading, error } = usePdfLoader(bookId);
```

### `usePdfRenderer`
Core PDF rendering engine with canvas management and queue system.

```typescript
const { renderPage, createPageElement, cancelAllRenderTasks } = usePdfRenderer(config);
```

### `useHighlights`
Manages text highlighting functionality.

```typescript
const { 
  highlights, 
  highlightColor, 
  addHighlight, 
  deleteHighlight, 
  applyHighlights 
} = useHighlights();
```

### `usePdfNavigation`
Handles page navigation and scrolling.

```typescript
const {
  currentPage,
  goToNextPage,
  goToPreviousPage,
  scrollToPage
} = usePdfNavigation(totalPages);
```

### `usePdfContextMenu`
Manages context menu state and interactions.

```typescript
const {
  contextMenu,
  handleContextMenu,
  closeContextMenu
} = usePdfContextMenu();
```

## 🎨 Styling

### `PdfTextLayer.css`
Contains all PDF.js compatible styling for text layers, annotations, and highlights.

### Dark Mode Support
Built-in dark mode with proper CSS filters and color inversions.

## 🔧 Configuration

### `constants.ts`
- Zoom level options
- Highlight color presets
- Render configuration (concurrent limits, delays, etc.)
- PDF file path mappings

### `types.ts`
- TypeScript interfaces for all data structures
- Component prop types
- Hook return types

## 🚀 Performance Optimizations

1. **Render Queue System**: Limits concurrent page renders to prevent canvas conflicts
2. **Intersection Observer**: Only renders visible pages
3. **Memoized Callbacks**: Prevents unnecessary re-renders
4. **Efficient DOM Updates**: Batch operations and fragment insertion
5. **Proper Cleanup**: Cancels ongoing operations on unmount

## 📝 Usage Example

```typescript
import { PdfViewer } from './components/PdfViewer';

function App() {
  return <PdfViewer />;
}
```

## 🔄 Migration from Original

The refactored component maintains the same external API while providing:

- Better code organization and maintainability
- Improved performance and stability
- Enhanced reusability of individual features
- Easier testing and debugging
- Better TypeScript support

## 🧪 Testing

Each hook can be tested independently, making the component more testable:

```typescript
import { renderHook } from '@testing-library/react';
import { useHighlights } from './hooks/useHighlights';

test('should add highlight', () => {
  const { result } = renderHook(() => useHighlights());
  // Test highlight functionality
});
```

## 🔮 Future Enhancements

The modular structure makes it easy to add new features:

- Annotation tools (shapes, arrows, etc.)
- Collaborative highlighting
- Search functionality
- Thumbnail previews
- Print optimization
- Accessibility improvements

## 📚 Dependencies

- React 18+
- Material-UI (MUI)
- PDF.js
- TypeScript