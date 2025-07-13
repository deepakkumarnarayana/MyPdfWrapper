import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
  MenuItem,
  Menu,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  ArrowBack,
  Highlight as HighlightIcon,
  TextFields,
} from '@mui/icons-material';
import * as pdfjsLib from 'pdfjs-dist';
// Import official PDF.js viewer CSS for proper text layer styling
import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';

import { useTableOfContents } from './hooks/useTableOfContents';
import { PdfToolbar } from './components/PdfToolbar';
import { TableOfContentsDrawer } from './components/TableOfContentsDrawer';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

// PDF.js compatible text layer CSS
const textLayerCSS = `
  .textLayer {
    position: absolute;
    text-align: initial;
    inset: 0;
    overflow: hidden;
    opacity: 1;
    line-height: 1;
    text-size-adjust: none;
    forced-color-adjust: none;
    transform-origin: 0 0;
    z-index: 2;
    pointer-events: auto;
  }
  
  .textLayer span {
    color: transparent;
    position: absolute;
    white-space: pre;
    cursor: text;
    transform-origin: 0% 0%;
    user-select: text;
    pointer-events: auto;
    -webkit-user-select: text;
    -moz-user-select: text;
    -ms-user-select: text;
  }
  
  .textLayer ::selection {
    background: rgba(0, 0, 255, 0.3);
  }
  
  .textLayer .endOfContent {
    display: block;
    position: absolute;
    inset: 0;
    z-index: -1;
    cursor: default;
    user-select: none;
  }
  
  .textLayer .endOfContent.active {
    top: 0;
  }
  
  .annotationLayer {
    position: absolute;
    text-align: initial;
    inset: 0;
    pointer-events: none;
    transform-origin: 0 0;
    z-index: 3;
  }
  
  .annotationLayer section {
    position: absolute;
    text-align: initial;
    pointer-events: auto;
    box-sizing: border-box;
    transform-origin: 0 0;
  }
  
  .annotationLayer .linkAnnotation {
    outline: 2px solid rgba(255, 255, 0, 0.4);
  }
  
  .annotationLayer .linkAnnotation:hover {
    opacity: 0.2;
    background: rgba(255, 255, 0, 1);
    box-shadow: 0 2px 10px rgba(255, 255, 0, 1);
  }
  
  .textLayer .highlight {
    background-color: rgba(255, 255, 0, 0.6);
    pointer-events: auto;
    position: absolute;
    z-index: 4;
    border: 1px solid rgba(255, 200, 0, 0.8);
    cursor: pointer;
  }
`;

interface PdfViewerProps {}

interface PageRenderInfo {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  textLayer: HTMLDivElement;
  annotationLayer: HTMLDivElement;
  container: HTMLDivElement;
  scale: number | string;
  rotation: number;
  rendered: boolean;
  rendering: boolean;
  textContent: any;
  annotations: any[];
}

interface Highlight {
  id: string;
  pageNumber: number;
  rects: { x: number; y: number; width: number; height: number }[];
  color: string;
  text: string;
  timestamp: Date;
}

interface ContextMenuState {
  mouseX: number;
  mouseY: number;
  text: string;
  highlightId?: string;
}

export const PdfViewer: React.FC<PdfViewerProps> = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  
  // State
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInput, setPageInput] = useState('1');
  const [zoomSelect, setZoomSelect] = useState('120');
  const [rotation, setRotation] = useState(0);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [darkMode, setDarkMode] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  
  // Refs
  const viewerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<Map<number, PageRenderInfo>>(new Map());
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const renderQueueRef = useRef<Set<number>>(new Set());
  const maxConcurrentRenders = useRef(2); // Limit concurrent renders to prevent conflicts
  
  // Table of Contents hook will be called after scrollToPage is defined
  
  // Zoom levels
  const zoomOptions = [
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
  
  // Highlight colors
  const highlightColors = [
    '#FFFF00', '#00FF00', '#FF0000', '#0000FF', '#FF00FF', '#00FFFF', '#FFA500'
  ];
  
  // Add CSS styles
  useEffect(() => {
    if (!styleRef.current) {
      styleRef.current = document.createElement('style');
      styleRef.current.textContent = textLayerCSS;
      document.head.appendChild(styleRef.current);
    }
    
    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current);
      }
    };
  }, []);
  
  // Load PDF
  useEffect(() => {
    if (!bookId) return;
    
    setIsLoading(true);
    setError(null);
    
    // Map book IDs to local PDF files
    let pdfPath = '/sample-pdfs/operating-systems-book.pdf';
    
    if (bookId === 'book-1') {
      pdfPath = '/sample-pdfs/operating-systems-book.pdf';
    } else if (bookId === 'book-2') {
      pdfPath = '/sample-pdfs/operating-systems-book.pdf';
    } else if (bookId === 'book-3') {
      pdfPath = '/sample-pdfs/multipage-sample.pdf';
    } else if (bookId === 'book-4') {
      pdfPath = '/sample-pdfs/sample-ml-book.pdf';
    }
    
    const loadingTask = pdfjsLib.getDocument({
      url: pdfPath,
      cMapUrl: new URL('pdfjs-dist/cmaps/', import.meta.url).toString(),
      cMapPacked: true,
      standardFontDataUrl: new URL('pdfjs-dist/standard_fonts/', import.meta.url).toString(),
    });
    
    loadingTask.promise
      .then((pdf) => {
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
        setPageInput('1');
        setIsLoading(false);
        
        // Extract table of contents
        extractTableOfContents(pdf);
      })
      .catch((err) => {
        console.error('Error loading PDF:', err);
        setError(`Failed to load PDF: ${err.message}`);
        setIsLoading(false);
      });
    
    return () => {
      // Cancel all ongoing render operations
      renderTasksRef.current.forEach(task => {
        if (task) task.cancel();
      });
      renderTasksRef.current.clear();
      renderQueueRef.current.clear();
      
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [bookId]);
  
  // Create page element
  const createPageElement = (pageNum: number): PageRenderInfo => {
    const container = document.createElement('div');
    container.className = 'page-container';
    container.setAttribute('data-page', pageNum.toString());
    container.style.cssText = `
      position: relative;
      margin: 0 auto 20px auto;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
      border: 1px solid #ccc;
      background: white;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
      page-break-inside: avoid;
    `;
    
    const canvas = document.createElement('canvas');
    // Add unique identifier to prevent canvas reuse
    canvas.id = `pdf-canvas-${pageNum}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    canvas.style.cssText = `
      display: block;
      max-width: 100%;
      height: auto;
    `;
    
    const textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    textLayer.id = `pdf-text-layer-${pageNum}-${Date.now()}`;
    
    const annotationLayer = document.createElement('div');
    annotationLayer.className = 'annotationLayer';
    annotationLayer.id = `pdf-annotation-layer-${pageNum}-${Date.now()}`;
    
    container.appendChild(canvas);
    container.appendChild(textLayer);
    container.appendChild(annotationLayer);
    
    return {
      pageNumber: pageNum,
      canvas,
      textLayer,
      annotationLayer,
      container,
      scale: 1,
      rotation: 0,
      rendered: false,
      rendering: false,
      textContent: null,
      annotations: [],
    };
  };
  
  // Render page with text and annotation layers
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc) return;
    
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo) return;
    
    // Skip if already rendering
    if (pageInfo.rendering) return;
    
    // Skip if already rendered at current scale and zoom settings
    const currentZoomScale = zoomSelect === 'auto' || zoomSelect === 'page-fit' ? 'dynamic' : scale;
    if (pageInfo.rendered && pageInfo.scale === currentZoomScale && pageInfo.rotation === rotation) return;
    
    // Check if we're at the concurrent render limit
    const currentRenderCount = renderTasksRef.current.size;
    if (currentRenderCount >= maxConcurrentRenders.current) {
      // Add to queue and return
      renderQueueRef.current.add(pageNum);
      return;
    }
    
    // Cancel any existing render task for this page first
    const existingTask = renderTasksRef.current.get(pageNum);
    if (existingTask) {
      try {
        existingTask.cancel();
        // Wait a bit for the cancellation to take effect
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (e) {
        // Ignore cancellation errors
      }
      renderTasksRef.current.delete(pageNum);
    }
    
    // Mark as rendering after cancelling existing task
    pageInfo.rendering = true;
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const { canvas, textLayer, annotationLayer } = pageInfo;
      const context = canvas.getContext('2d');
      
      if (!context) return;
      
      // Define current zoom scale for later use
      const currentZoomScale = zoomSelect === 'auto' || zoomSelect === 'page-fit' ? 'dynamic' : scale;
      
      // Calculate scale
      let renderScale = scale;
      if (zoomSelect === 'auto' && viewerRef.current) {
        const containerWidth = viewerRef.current.clientWidth - 60;
        const viewport = page.getViewport({ scale: 1, rotation });
        renderScale = containerWidth / viewport.width;
      } else if (zoomSelect === 'page-fit' && viewerRef.current) {
        const containerHeight = viewerRef.current.clientHeight - 60;
        const viewport = page.getViewport({ scale: 1, rotation });
        renderScale = Math.min(
          (viewerRef.current.clientWidth - 60) / viewport.width,
          containerHeight / viewport.height
        );
      }
      
      const viewport = page.getViewport({ scale: renderScale, rotation });
      
      // Set canvas dimensions
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = viewport.width + 'px';
      canvas.style.height = viewport.height + 'px';
      
      // Update container size
      pageInfo.container.style.width = viewport.width + 'px';
      pageInfo.container.style.height = viewport.height + 'px';
      
      // Ensure text layer matches canvas exactly
      textLayer.style.width = viewport.width + 'px';
      textLayer.style.height = viewport.height + 'px';
      textLayer.style.top = '0px';
      textLayer.style.left = '0px';
      
      // Clear and render page
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Check if this canvas is already being used for rendering
      const isCanvasInUse = Array.from(renderTasksRef.current.values()).some(task => 
        task && task._internalRenderTask && task._internalRenderTask.canvas === canvas
      );
      
      if (isCanvasInUse) {
        console.warn(`Canvas for page ${pageNum} is already in use, skipping render`);
        pageInfo.rendering = false;
        return;
      }
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      // Create a new render task and store it immediately
      const renderTask = page.render(renderContext);
      renderTasksRef.current.set(pageNum, renderTask);
      
      // Wait for render completion with proper error handling
      try {
        await renderTask.promise;
      } catch (renderError) {
        // If render was cancelled, clean up and return
        if (renderError && typeof renderError === 'object' && 'name' in renderError && 
            renderError.name === 'RenderingCancelledException') {
          pageInfo.rendering = false;
          renderTasksRef.current.delete(pageNum);
          return;
        }
        throw renderError;
      }
      
      // Render text layer using official PDF.js TextLayer class
      const textContent = await page.getTextContent();
      pageInfo.textContent = textContent;
      
      // Clear and setup text layer
      textLayer.innerHTML = '';
      
      // Set scale factor for PDF.js TextLayer
      textLayer.style.setProperty('--scale-factor', renderScale.toString());
      
      try {
        // Use the renderTextLayer API but ensure proper viewport cloning
        const pdfjsLib = await import('pdfjs-dist');
        
        if (pdfjsLib.renderTextLayer) {
          // Clone viewport to prevent transformation issues
          const clonedViewport = viewport.clone({ dontFlip: true });
          
          await pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayer,
            viewport: clonedViewport,
            textDivs: [],
          }).promise;
          
          // Apply existing highlights after text layer is rendered
          if (highlights.length > 0) {
            requestAnimationFrame(() => applyHighlights(pageNum));
          }
        } else {
          console.error('renderTextLayer not available');
        }
      } catch (error) {
        console.error('Failed to render text layer:', error);
      }
      
      // Render annotation layer
      const annotations = await page.getAnnotations();
      pageInfo.annotations = annotations;
      
      annotationLayer.innerHTML = '';
      annotationLayer.style.width = viewport.width + 'px';
      annotationLayer.style.height = viewport.height + 'px';
      
      if (annotations.length > 0) {
        annotations.forEach((annotation: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (annotation.subtype === 'Link') {
            const linkDiv = document.createElement('div');
            linkDiv.className = 'linkAnnotation';
            linkDiv.style.position = 'absolute';
            linkDiv.style.left = annotation.rect[0] + 'px';
            linkDiv.style.top = (viewport.height - annotation.rect[3]) + 'px';
            linkDiv.style.width = (annotation.rect[2] - annotation.rect[0]) + 'px';
            linkDiv.style.height = (annotation.rect[3] - annotation.rect[1]) + 'px';
            linkDiv.style.border = '2px solid rgba(255, 255, 0, 0.4)';
            linkDiv.style.cursor = 'pointer';
            
            if (annotation.url) {
              linkDiv.onclick = () => window.open(annotation.url, '_blank');
            }
            
            annotationLayer.appendChild(linkDiv);
          }
        });
      }
      
      // Apply highlights
      applyHighlights(pageNum);
      
      pageInfo.rendered = true;
      pageInfo.rendering = false;
      pageInfo.scale = currentZoomScale;
      pageInfo.rotation = rotation;
      renderTasksRef.current.delete(pageNum);
      
      // Process next item in queue
      if (renderQueueRef.current.size > 0) {
        const nextPageNum = renderQueueRef.current.values().next().value;
        if (nextPageNum !== undefined) {
          renderQueueRef.current.delete(nextPageNum);
          // Use setTimeout with a small delay to avoid conflicts
          setTimeout(() => renderPage(nextPageNum), 10);
        }
      }
      
    } catch (err) {
      pageInfo.rendering = false;
      renderTasksRef.current.delete(pageNum);
      console.error(`Error rendering page ${pageNum}:`, err);
      if (err instanceof Error && err.message.includes('cancelled')) {
        return;
      }
      
      // Process next item in queue even on error
      if (renderQueueRef.current.size > 0) {
        const nextPageNum = renderQueueRef.current.values().next().value;
        if (nextPageNum !== undefined) {
          renderQueueRef.current.delete(nextPageNum);
          setTimeout(() => renderPage(nextPageNum), 10);
        }
      }
    }
  }, [pdfDoc, scale, zoomSelect, rotation]);

  
  // Apply highlights to page using provided highlights array
  const applyHighlightsToPage = useCallback((pageNum: number, highlightsArray: Highlight[]) => {
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo) return;
    
    const pageHighlights = highlightsArray.filter(h => h.pageNumber === pageNum);
    
    // Clear existing highlights efficiently
    const existingHighlights = pageInfo.textLayer.querySelectorAll('.highlight');
    existingHighlights.forEach(el => el.remove());
    
    // Create document fragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    
    pageHighlights.forEach((highlight) => {
      highlight.rects.forEach((rect) => {
        const highlightDiv = document.createElement('div');
        highlightDiv.className = 'highlight';
        highlightDiv.setAttribute('data-highlight-id', highlight.id);
        highlightDiv.title = `"${highlight.text}" - Right-click to delete`;
        
        // Optimized inline styles with click detection - lighter opacity for better readability
        highlightDiv.style.cssText = `position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;background-color:${highlight.color};opacity:0.3;pointer-events:auto;z-index:4;cursor:pointer;border:1px solid ${highlight.color};border-opacity:0.8;`;
        
        // Add right-click handler for deletion
        highlightDiv.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          setContextMenu({
            mouseX: e.clientX,
            mouseY: e.clientY,
            text: highlight.text,
            highlightId: highlight.id,
          });
        });
        
        fragment.appendChild(highlightDiv);
      });
    });
    
    // Single DOM insertion
    pageInfo.textLayer.appendChild(fragment);
  }, []);

  // Apply highlights to page using current state  
  const applyHighlights = useCallback((pageNum: number) => {
    applyHighlightsToPage(pageNum, highlights);
  }, [highlights, applyHighlightsToPage]);
  
  // Handle text selection
  const handleTextSelection = useCallback(() => {
    // Text selection tracking is handled by context menu
  }, []);
  
  // Handle context menu
  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setContextMenu({
        mouseX: event.clientX,
        mouseY: event.clientY,
        text: selection.toString().trim(),
      });
    }
  };
  
  // Add highlight
  const addHighlight = useCallback((color: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) return;
    
    try {
      const range = selection.getRangeAt(0);
      
      // Find the text layer containing the selection
      let element = range.commonAncestorContainer;
      let textLayer: Element | null = null;
      
      // Traverse up to find text layer (optimized)
      while (element && element !== document.body) {
        if (element.nodeType === Node.ELEMENT_NODE) {
          const el = element as Element;
          if (el.classList.contains('textLayer')) {
            textLayer = el;
            break;
          }
        }
        element = element.parentNode as Node;
      }
      
      if (!textLayer) return;
      
      // Find page container and number
      const pageContainer = textLayer.closest('.page-container');
      if (!pageContainer) return;
      
      let pageNum = parseInt(pageContainer.getAttribute('data-page') || '0');
      if (pageNum === 0) {
        const foundPage = Array.from(pagesRef.current.entries()).find(([, info]) => 
          info.textLayer === textLayer
        );
        if (!foundPage) return;
        pageNum = foundPage[0];
      }
      
      // Calculate highlight rectangles
      const textLayerRect = textLayer.getBoundingClientRect();
      const rects = Array.from(range.getClientRects()).map(rect => ({
        x: rect.left - textLayerRect.left,
        y: rect.top - textLayerRect.top,
        width: rect.width,
        height: rect.height,
      }));
      
      if (rects.length === 0) return;
      
      const highlight: Highlight = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        pageNumber: pageNum,
        rects,
        color,
        text: selection.toString().trim(),
        timestamp: new Date(),
      };
      
      setHighlights(prev => [...prev, highlight]);
      
      // Clear selection
      selection.removeAllRanges();
      setContextMenu(null);
      
    } catch (error) {
      console.error('Error adding highlight:', error);
    }
  }, []);

  // Delete highlight
  const deleteHighlight = useCallback((highlightId: string) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId));
    setContextMenu(null);
  }, []);
  
  
  // Create and render all pages
  useEffect(() => {
    if (!pdfDoc || !viewerRef.current) return;
    
    const viewer = viewerRef.current;
    
    // Only clear and recreate if we don't have the right number of pages
    const currentPageCount = pagesRef.current.size;
    if (currentPageCount !== totalPages) {
      // Cancel all ongoing renders first
      renderTasksRef.current.forEach(task => {
        try {
          task.cancel();
        } catch (e) {
          // Ignore errors
        }
      });
      renderTasksRef.current.clear();
      renderQueueRef.current.clear();
      
      // Clear existing pages
      viewer.innerHTML = '';
      pagesRef.current.clear();
      
      // Create all page elements first
      for (let i = 1; i <= totalPages; i++) {
        const pageInfo = createPageElement(i);
        viewer.appendChild(pageInfo.container);
        pagesRef.current.set(i, pageInfo);
      }
    }
    
    // Set up intersection observer for all pages after they're created
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    observerRef.current = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        let topMostVisiblePage: number | null = null;
        let topMostPosition = Infinity;
        
        entries.forEach(entry => {
          const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
          if (pageNum > 0) {
            if (entry.isIntersecting) {
              // Always try to render intersecting pages
              renderPage(pageNum);
              
              // Track the topmost visible page for current page updates
              const rect = entry.boundingClientRect;
              const viewerRect = viewerRef.current?.getBoundingClientRect();
              
              if (viewerRect) {
                const relativeTop = rect.top - viewerRect.top;
                const pageHeight = rect.height;
                const viewerHeight = viewerRect.height;
                
                // Consider a page as "current" if it's in the top half of the viewer
                const isInTopHalf = relativeTop < viewerHeight / 2 && relativeTop > -pageHeight / 2;
                const intersectionRatio = entry.intersectionRatio || 0;
                
                if (isInTopHalf || (intersectionRatio > 0.3 && relativeTop < topMostPosition)) {
                  topMostPosition = relativeTop;
                  topMostVisiblePage = pageNum;
                }
              }
            }
          }
        });
        
        // Update current page if we found a visible page and it's different
        if (topMostVisiblePage !== null && topMostVisiblePage !== currentPage) {
          const pageNumber: number = topMostVisiblePage;
          setCurrentPage(pageNumber);
          setPageInput(pageNumber.toString());
        }
      },
      {
        root: viewerRef.current,
        rootMargin: '100px', // Reduced margin to be less aggressive
        threshold: [0.1, 0.3, 0.5],
      }
    );
    
    // Observe all page containers
    if (observerRef.current) {
      pagesRef.current.forEach(pageInfo => {
        if (observerRef.current) {
          observerRef.current.observe(pageInfo.container);
        }
      });
    }
    
    // Render first few pages immediately for better experience
    for (let i = 1; i <= Math.min(3, totalPages); i++) {
      renderPage(i);
    }
    
  }, [pdfDoc, totalPages, renderPage]);
  
  // Re-render pages when scale or rotation changes
  useEffect(() => {
    if (!pdfDoc) return;
    
    // Cancel all ongoing renders and mark for re-render
    renderTasksRef.current.forEach(task => {
      try {
        task.cancel();
      } catch (e) {
        // Ignore errors
      }
    });
    renderTasksRef.current.clear();
    renderQueueRef.current.clear();
    
    // Mark all pages as not rendered and reset rendering state
    pagesRef.current.forEach(pageInfo => {
      pageInfo.rendered = false;
      pageInfo.rendering = false;
    });
    
    // Re-render only currently visible pages based on currentPage
    const startPage = Math.max(1, currentPage - 1);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
      renderPage(i);
    }
    
  }, [pdfDoc, scale, zoomSelect, rotation, renderPage, currentPage, totalPages]);
  
  // Re-apply highlights when they change
  useEffect(() => {
    // Re-apply highlights to all rendered pages with a small delay to ensure rendering is complete
    const timeout = setTimeout(() => {
      pagesRef.current.forEach((pageInfo, pageNum) => {
        if (pageInfo.rendered && !pageInfo.rendering) {
          applyHighlights(pageNum);
        }
      });
    }, 50);
    
    return () => clearTimeout(timeout);
  }, [highlights, applyHighlights]);
  
  // Add text selection listener
  useEffect(() => {
    document.addEventListener('selectionchange', handleTextSelection);
    return () => {
      document.removeEventListener('selectionchange', handleTextSelection);
    };
  }, [handleTextSelection]);
  
  // Handle zoom change
  const handleZoomChange = (value: string) => {
    setZoomSelect(value);
    if (value === 'auto' || value === 'page-fit') {
      // Will be calculated in renderPage
    } else {
      setScale(parseInt(value) / 100);
    }
  };
  
  // Navigation functions
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
      scrollToPage(newPage);
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      setPageInput(newPage.toString());
      scrollToPage(newPage);
    }
  };
  
  const goToFirstPage = () => {
    setCurrentPage(1);
    setPageInput('1');
    scrollToPage(1);
  };
  
  const goToLastPage = () => {
    setCurrentPage(totalPages);
    setPageInput(totalPages.toString());
    scrollToPage(totalPages);
  };
  
  const scrollToPage = (pageNum: number) => {
    const pageInfo = pagesRef.current.get(pageNum);
    if (pageInfo && viewerRef.current) {
      pageInfo.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Table of Contents
  const {
    tocItems,
    isTocOpen,
    tocLoading,
    extractTableOfContents,
    toggleToc,
    handleTocItemClick,
    handleTocItemToggle,
  } = useTableOfContents(pdfDoc, setCurrentPage, setPageInput, scrollToPage);
  
  const handlePageInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(event.target.value);
  };
  
  const handlePageInputSubmit = () => {
    const pageNum = parseInt(pageInput, 10);
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      scrollToPage(pageNum);
    } else {
      setPageInput(currentPage.toString());
    }
  };
  
  // Handle rotation
  const rotateLeft = () => {
    setRotation(prev => (prev - 90) % 360);
  };
  
  const rotateRight = () => {
    setRotation(prev => (prev + 90) % 360);
  };
  
  // Handle back navigation
  const handleBack = () => {
    navigate('/dashboard');
  };
  
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: '#525659',
        }}
      >
        <CircularProgress size={48} sx={{ color: 'white' }} />
        <Typography variant="h6" sx={{ color: 'white' }}>Loading PDF...</Typography>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box sx={{ p: 3, backgroundColor: '#525659', minHeight: '100vh' }}>
        <Card>
          <CardContent>
            <Typography color="error" variant="h6" gutterBottom>
              {error}
            </Typography>
            <Button
              variant="contained"
              startIcon={<ArrowBack />}
              onClick={handleBack}
              sx={{ mt: 2 }}
            >
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }
  
  const bookTitle = `PDF Viewer - Book ${bookId}`;

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <PdfToolbar
        bookTitle={bookTitle}
        handleBack={handleBack}
        toggleToc={toggleToc}
        tocItems={tocItems}
        goToFirstPage={goToFirstPage}
        goToPreviousPage={goToPreviousPage}
        goToNextPage={goToNextPage}
        goToLastPage={goToLastPage}
        currentPage={currentPage}
        totalPages={totalPages}
        pageInput={pageInput}
        handlePageInputChange={handlePageInputChange}
        handlePageInputSubmit={handlePageInputSubmit}
        zoomOptions={zoomOptions}
        zoomSelect={zoomSelect}
        handleZoomChange={handleZoomChange}
        rotateLeft={rotateLeft}
        rotateRight={rotateRight}
        highlightColors={highlightColors}
        highlightColor={highlightColor}
        setHighlightColor={setHighlightColor}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />

      {/* Table of Contents Drawer */}
      <TableOfContentsDrawer
        isTocOpen={isTocOpen}
        toggleToc={toggleToc}
        tocItems={tocItems}
        tocLoading={tocLoading}
        handleTocItemClick={handleTocItemClick}
        handleTocItemToggle={handleTocItemToggle}
        currentPage={currentPage}
      />
      
      {/* PDF Viewer */}
      <Box
        ref={viewerRef}
        onContextMenu={handleContextMenu}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          backgroundColor: darkMode ? '#1a1a1a' : '#525659',
          p: 2,
          filter: darkMode ? 'invert(1) hue-rotate(180deg)' : 'none',
          '&::-webkit-scrollbar': {
            width: '12px',
          },
          '&::-webkit-scrollbar-track': {
            background: '#404040',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#666',
            borderRadius: '6px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: '#888',
          },
        }}
      >
        {/* Pages will be inserted here by JavaScript */}
      </Box>
      
      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : { top: 0, left: 0 }
        }
        disableAutoFocus
        disableEnforceFocus
      >
        {contextMenu?.highlightId ? (
          // Context menu for existing highlights
          <MenuItem onClick={() => contextMenu.highlightId && deleteHighlight(contextMenu.highlightId)}>
            <ListItemIcon>
              <HighlightIcon sx={{ color: 'red' }} />
            </ListItemIcon>
            <ListItemText>Delete Highlight</ListItemText>
          </MenuItem>
        ) : (
          // Context menu for text selection
          <>
            <MenuItem onClick={() => addHighlight(highlightColor)}>
              <ListItemIcon>
                <HighlightIcon sx={{ color: highlightColor }} />
              </ListItemIcon>
              <ListItemText>Highlight</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => {
              navigator.clipboard.writeText(contextMenu?.text || '');
              setContextMenu(null);
            }}>
              <ListItemIcon>
                <TextFields />
              </ListItemIcon>
              <ListItemText>Copy Text</ListItemText>
            </MenuItem>
          </>
        )}
      </Menu>
    </Box>
  );
};