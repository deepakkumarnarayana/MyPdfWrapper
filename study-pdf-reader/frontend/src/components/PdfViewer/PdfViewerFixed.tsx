import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';

// Import PDF.js viewer CSS for proper text layer styling
import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';
import './styles/PdfTextLayer.css';

// Custom hooks
import { usePdfLoader } from './hooks/usePdfLoader';
import { useHighlights } from './hooks/useHighlights';
import { usePdfContextMenu } from './hooks/usePdfContextMenu';
import { useTableOfContents } from './hooks/useTableOfContents';

// API services
import { booksApi } from '../../services/api/books.api';

// Components
import { PdfToolbar } from './components/PdfToolbar';
import { TableOfContentsDrawer } from './components/TableOfContentsDrawer';
import { PdfContextMenu } from './components/PdfContextMenu';

// Types and constants
import { PageRenderInfo } from './types';
import { ZOOM_OPTIONS, HIGHLIGHT_COLORS } from './constants';

export const PdfViewer: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  
  // Refs
  const viewerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<Map<number, PageRenderInfo>>(new Map());
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  const renderQueueRef = useRef<Set<number>>(new Set());
  const maxConcurrentRenders = useRef(3); // Increased for better performance
  
  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [scale, setScale] = useState(1.2);
  const [zoomSelect, setZoomSelect] = useState('120');
  const [rotation, setRotation] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  
  // Custom hooks
  const { pdfDoc, totalPages, isLoading, error, bookData, lastReadPage } = usePdfLoader(bookId);
  
  const {
    highlights,
    highlightColor,
    setHighlightColor,
    applyHighlights,
    addHighlight,
    deleteHighlight,
  } = useHighlights();
  
  const {
    contextMenu,
    handleContextMenu,
    handleHighlightContextMenu,
    closeContextMenu,
    copyText,
  } = usePdfContextMenu();

  // Navigation functions (defined early to avoid temporal dead zone)
  const scrollToPage = useCallback((pageNum: number) => {
    const pageInfo = pagesRef.current.get(pageNum);
    if (pageInfo && viewerRef.current) {
      pageInfo.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);
  
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

  // Create page element (simplified from usePdfRenderer)
  const createPageElement = useCallback((pageNum: number): PageRenderInfo => {
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
  }, []);

  // Create stable references to prevent renderPage from changing unnecessarily
  const applyHighlightsRef = useRef(applyHighlights);
  const handleHighlightContextMenuRef = useRef(handleHighlightContextMenu);
  const scaleRef = useRef(scale);
  const zoomSelectRef = useRef(zoomSelect);
  const rotationRef = useRef(rotation);
  
  // Update refs when values change
  useEffect(() => {
    applyHighlightsRef.current = applyHighlights;
    handleHighlightContextMenuRef.current = handleHighlightContextMenu;
    scaleRef.current = scale;
    zoomSelectRef.current = zoomSelect;
    rotationRef.current = rotation;
  });
  

  // Render page with improved performance
  const renderPage = useCallback(async (pageNum: number, priority: 'high' | 'normal' = 'normal') => {
    if (!pdfDoc) return;
    
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo) return;
    
    // Skip if already rendering
    if (pageInfo.rendering) {
      return;
    }
    
    // Calculate the actual render scale first to ensure consistent comparison
    let renderScale = scaleRef.current;
    const containerDims = containerDimensionsRef.current;
    
    if (zoomSelectRef.current === 'auto' && containerDims.width > 0) {
      const tempPage = await pdfDoc.getPage(pageNum);
      const viewport = tempPage.getViewport({ scale: 1, rotation: rotationRef.current });
      renderScale = containerDims.width / viewport.width;
    } else if (zoomSelectRef.current === 'page-fit' && containerDims.width > 0 && containerDims.height > 0) {
      const tempPage = await pdfDoc.getPage(pageNum);
      const viewport = tempPage.getViewport({ scale: 1, rotation: rotationRef.current });
      renderScale = Math.min(
        containerDims.width / viewport.width,
        containerDims.height / viewport.height
      );
    }
    
    // Skip if already rendered at current scale and zoom settings
    const expectedScale = zoomSelectRef.current === 'auto' || zoomSelectRef.current === 'page-fit' ? 'dynamic' : renderScale;
    if (pageInfo.rendered && pageInfo.scale === expectedScale && pageInfo.rotation === rotationRef.current) {
      return; // Silent skip for already rendered pages
    }
    
    // Check if we're at the concurrent render limit
    const currentRenderCount = renderTasksRef.current.size;
    if (currentRenderCount >= maxConcurrentRenders.current) {
      if (priority === 'high') {
        // For high priority, add to front of queue by clearing and re-adding
        const queueArray = Array.from(renderQueueRef.current);
        renderQueueRef.current.clear();
        renderQueueRef.current.add(pageNum);
        queueArray.forEach(p => renderQueueRef.current.add(p));
      } else {
        renderQueueRef.current.add(pageNum);
      }
      return;
    }
    
    // console.log(`🎨 [RENDER] Starting page ${pageNum}`);
    
    // Cancel any existing render task for this page first
    const existingTask = renderTasksRef.current.get(pageNum);
    if (existingTask) {
      try {
        existingTask.cancel();
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (e) {
        // Ignore cancellation errors
      }
      renderTasksRef.current.delete(pageNum);
    }
    
    // Mark as rendering after cancelling existing task
    pageInfo.rendering = true;
    const renderStartTime = Date.now();
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const { canvas, textLayer, annotationLayer } = pageInfo;
      const context = canvas.getContext('2d');
      
      if (!context) return;
      
      // Store the actual render scale used for comparison  
      const actualRenderScale = zoomSelectRef.current === 'auto' || zoomSelectRef.current === 'page-fit' ? 'dynamic' : renderScale;
      
      const viewport = page.getViewport({ scale: renderScale, rotation: rotationRef.current });
      
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
          requestAnimationFrame(() => applyHighlightsRef.current(pageNum, pagesRef, handleHighlightContextMenuRef.current));
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
      applyHighlightsRef.current(pageNum, pagesRef, handleHighlightContextMenuRef.current);
      
      pageInfo.rendered = true;
      pageInfo.rendering = false;
      pageInfo.scale = actualRenderScale;
      pageInfo.rotation = rotationRef.current;
      renderTasksRef.current.delete(pageNum);
      
      console.log(`✅ [RENDER DEBUG] Page ${pageNum} render completed successfully:`, {
        renderTime: Date.now() - renderStartTime,
        scale: actualRenderScale,
        renderScale,
        zoomSelect: zoomSelectRef.current,
        rotation: rotationRef.current,
        remainingQueue: renderQueueRef.current.size,
        activeRenders: renderTasksRef.current.size
      });
      
      // Process next item in queue with reduced delay
      if (renderQueueRef.current.size > 0) {
        const nextPageNum = renderQueueRef.current.values().next().value;
        if (nextPageNum !== undefined) {
          renderQueueRef.current.delete(nextPageNum);
          
          console.log(`🔄 [RENDER DEBUG] Processing queued page ${nextPageNum} (${renderQueueRef.current.size} remaining)`);
          // Reduced delay for faster processing
          setTimeout(() => renderPage(nextPageNum), 5);
        }
      } else {
        console.log(`📋 [RENDER DEBUG] Render queue empty, no more pages to process`);
      }
      
    } catch (err) {
      pageInfo.rendering = false;
      renderTasksRef.current.delete(pageNum);
      
      console.error(`❌ [RENDER DEBUG] Error rendering page ${pageNum}:`, {
        error: err,
        renderTime: Date.now() - renderStartTime,
        isCancellation: err instanceof Error && err.message.includes('cancelled'),
        queueSize: renderQueueRef.current.size,
        activeRenders: renderTasksRef.current.size
      });
      
      if (err instanceof Error && err.message.includes('cancelled')) {
        console.log(`🚫 [RENDER DEBUG] Page ${pageNum} render was cancelled`);
        return;
      }
      
      // Process next item in queue even on error
      if (renderQueueRef.current.size > 0) {
        const nextPageNum = renderQueueRef.current.values().next().value;
        if (nextPageNum !== undefined) {
          renderQueueRef.current.delete(nextPageNum);
          
          console.log(`🔄 [RENDER DEBUG] Processing queued page ${nextPageNum} after error (${renderQueueRef.current.size} remaining)`);
          setTimeout(() => renderPage(nextPageNum), 5);
        }
      }
    }
  }, [pdfDoc]); // Only pdfDoc dependency - all other values use refs

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

  // Add CSS styles
  useEffect(() => {
    if (!styleRef.current) {
      styleRef.current = document.createElement('style');
      styleRef.current.textContent = `
        .page-container {
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
        }
      `;
      document.head.appendChild(styleRef.current);
    }
    
    return () => {
      if (styleRef.current) {
        document.head.removeChild(styleRef.current);
        styleRef.current = null;
      }
    };
  }, []);

  // Optimized scroll event handling with debouncing + text selection detection
  useEffect(() => {
    if (!viewerRef.current) return;
    
    const viewer = viewerRef.current;
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let isScrolling = false;
    
    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true;
        // Immediately trigger rendering for visible pages during scroll
        requestAnimationFrame(() => {
          // This will be handled by intersection observer
          isScrolling = false;
        });
      }
      
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      scrollTimeout = setTimeout(() => {
        // Optional: Log scroll end for debugging
        // console.log(`📜 [DEBUG] Scroll ended at ${viewer.scrollTop.toFixed(0)}px`);
      }, 100); // Reduced timeout for faster response
    };
    
    viewer.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      viewer.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [currentPage]);

  // Create and manage PDF pages
  useEffect(() => {
    if (!pdfDoc || !viewerRef.current) return;
    
    const viewer = viewerRef.current;
    
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
    
    // Clear existing pages and reset state
    viewer.innerHTML = '';
    pagesRef.current.clear();
    
    // Create all page elements
    for (let i = 1; i <= totalPages; i++) {
      const pageInfo = createPageElement(i);
      viewer.appendChild(pageInfo.container);
      pagesRef.current.set(i, pageInfo);
    }
    
    // Set up intersection observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    
    let intersectionTimeout: ReturnType<typeof setTimeout> | null = null;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (intersectionTimeout) {
          clearTimeout(intersectionTimeout);
        }
        
        intersectionTimeout = setTimeout(() => {
          let topMostVisiblePage: number | null = null;
          let maxIntersectionRatio = 0;
          const visiblePages = new Set<number>();
          
          entries.forEach(entry => {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
            if (pageNum > 0 && entry.isIntersecting) {
              visiblePages.add(pageNum);
              
              if (entry.intersectionRatio > maxIntersectionRatio) {
                maxIntersectionRatio = entry.intersectionRatio;
                topMostVisiblePage = pageNum;
              }
            }
          });
          
          // Render visible pages with priority
          visiblePages.forEach(pageNum => {
            // High priority for pages very close to current page
            const priority = Math.abs(pageNum - currentPage) <= 1 ? 'high' : 'normal';
            renderPage(pageNum, priority);
          });
          
          // Pre-render adjacent pages for smoother scrolling
          visiblePages.forEach(pageNum => {
            const nextPage = pageNum + 1;
            const prevPage = pageNum - 1;
            if (nextPage <= totalPages) {
              setTimeout(() => renderPage(nextPage, 'normal'), 20);
            }
            if (prevPage >= 1) {
              setTimeout(() => renderPage(prevPage, 'normal'), 20);
            }
          });
          
          if (topMostVisiblePage !== null && topMostVisiblePage !== currentPage && maxIntersectionRatio > 0.3) {
            setCurrentPage(topMostVisiblePage);
            setPageInput(String(topMostVisiblePage));
          }
        }, 50); // Reduced timeout for faster response
      },
      {
        root: viewerRef.current,
        rootMargin: '100px',
        threshold: [0.1, 0.3, 0.5, 0.7],
      }
    );
    
    pagesRef.current.forEach(pageInfo => {
      if (observerRef.current) {
        observerRef.current.observe(pageInfo.container);
      }
    });
    
    // Render initial pages - prioritize current/last read page if available
    const targetPage = lastReadPage && lastReadPage > 1 ? lastReadPage : 1;
    const isResuming = lastReadPage && lastReadPage > 1;
    
    if (isResuming) {
      // User is resuming - render around the last read page first
      const startPage = Math.max(1, targetPage - 1);
      const endPage = Math.min(totalPages, targetPage + 1);
      
      // Render current page first (highest priority)
      renderPage(targetPage, 'high');
      
      // Render surrounding pages
      if (startPage < targetPage) renderPage(startPage, 'normal');
      if (endPage > targetPage) {
        setTimeout(() => renderPage(endPage, 'normal'), 50);
      }
      
      // Render initial pages later if they weren't already rendered
      if (targetPage > 3) {
        setTimeout(() => {
          renderPage(1, 'normal');
          renderPage(2, 'normal');
        }, 200);
      }
    } else {
      // New reading - render initial pages normally
      const initialPagesToRender = Math.min(5, totalPages);
      for (let i = 1; i <= initialPagesToRender; i++) {
        if (i <= 2) {
          renderPage(i, 'high');
        } else {
          setTimeout(() => renderPage(i, 'normal'), (i - 2) * 100);
        }
      }
    }
    
    // Extract table of contents
    extractTableOfContents(pdfDoc);
    
  }, [pdfDoc, totalPages, lastReadPage, createPageElement, extractTableOfContents, renderPage]);
  
  // Track container dimensions to prevent infinite loops
  const containerDimensionsRef = useRef({ width: 0, height: 0 });
  
  // Update container dimensions when viewer is available or window resizes
  useEffect(() => {
    const updateContainerDimensions = () => {
      if (viewerRef.current) {
        const rect = viewerRef.current.getBoundingClientRect();
        containerDimensionsRef.current = {
          width: rect.width - 60,
          height: rect.height - 60
        };
      }
    };
    
    updateContainerDimensions();
    
    // Add resize listener
    window.addEventListener('resize', updateContainerDimensions);
    return () => window.removeEventListener('resize', updateContainerDimensions);
  }, [pdfDoc, totalPages]);
  
  // Re-render pages when scale or rotation changes
  useEffect(() => {
    if (!pdfDoc) return;
    
    console.log('🔄 [SCALE DEBUG] Scale/rotation change detected:', {
      scale,
      zoomSelect,
      rotation,
      totalPages,
      activeRenders: renderTasksRef.current.size,
      queueSize: renderQueueRef.current.size,
    });
    
    // Save current scroll position to restore after re-render
    const viewer = viewerRef.current;
    let scrollTop = 0;
    let scrollLeft = 0;
    if (viewer) {
      scrollTop = viewer.scrollTop;
      scrollLeft = viewer.scrollLeft;
    }
    
    // Cancel all ongoing renders and mark for re-render
    console.log('🚫 [SCALE DEBUG] Cancelling all ongoing renders...');
    renderTasksRef.current.forEach((task) => {
      if (task) {
        try {
          task.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
      }
    });
    renderTasksRef.current.clear();
    renderQueueRef.current.clear();
    
    console.log('🔄 [SCALE DEBUG] Marking only rendered pages as not rendered...');
    let resetCount = 0;
    pagesRef.current.forEach((pageInfo, pageNum) => {
      // Only reset pages that were actually rendered to avoid unnecessary work
      if (pageInfo.rendered || pageInfo.rendering) {
        pageInfo.rendered = false;
        pageInfo.rendering = false;
        resetCount++;
        console.log(`🔄 [SCALE DEBUG] Resetting rendered page ${pageNum}`);
      }
    });
    console.log(`🔄 [SCALE DEBUG] Reset ${resetCount} rendered pages (out of ${pagesRef.current.size} total)`);
    
    // Re-render visible pages around current page with priority
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    console.log(`🎯 [SCALE DEBUG] Re-rendering visible pages ${startPage} to ${endPage} (around page ${currentPage})`);
    
    // Render current page first with high priority
    console.log(`🎨 [SCALE DEBUG] Triggering high priority render for current page ${currentPage}`);
    renderPage(currentPage, 'high');
    
    // Then render adjacent pages with staggered timing
    for (let i = startPage; i <= endPage; i++) {
      if (i !== currentPage) {
        const priority = Math.abs(i - currentPage) <= 1 ? 'high' : 'normal';
        const delay = Math.abs(i - currentPage) * 50; // Stagger by distance from current page
        console.log(`🎨 [SCALE DEBUG] Triggering ${priority} priority render for page ${i} with ${delay}ms delay`);
        setTimeout(() => renderPage(i, priority), delay);
      }
    }
    
    // Restore scroll position after pages are re-rendered
    if (viewer && (scrollTop > 0 || scrollLeft > 0)) {
      // Use requestAnimationFrame to ensure rendering is complete
      requestAnimationFrame(() => {
        viewer.scrollTop = scrollTop;
        viewer.scrollLeft = scrollLeft;
        console.log(`📜 [SCROLL DEBUG] Restored scroll position: top=${scrollTop}, left=${scrollLeft}`);
      });
    }
    
  }, [scale, zoomSelect, rotation, totalPages]);
  
  // Re-apply highlights when they change
  useEffect(() => {
    // Re-apply highlights to all rendered pages with a small delay to ensure rendering is complete
    const timeout = setTimeout(() => {
      pagesRef.current.forEach((pageInfo, pageNum) => {
        if (pageInfo.rendered && !pageInfo.rendering) {
          applyHighlightsRef.current(pageNum, pagesRef, handleHighlightContextMenuRef.current);
        }
      });
    }, 50);
    
    return () => clearTimeout(timeout);
  }, [highlights]);

  // Restore reading position when book data loads
  useEffect(() => {
    if (bookData && lastReadPage && lastReadPage > 1 && totalPages > 0) {
      setCurrentPage(lastReadPage);
      setPageInput(lastReadPage.toString());
      
      // Scroll to the last read page with minimal delay (page is already rendered)
      setTimeout(() => {
        scrollToPage(lastReadPage);
      }, 100);
    }
  }, [bookData, lastReadPage, totalPages, scrollToPage]);

  // Auto-save reading progress when user changes pages
  useEffect(() => {
    if (bookData && bookId && currentPage > 1) {
      const saveProgress = async () => {
        try {
          await booksApi.updateBook(bookId, {
            lastReadPage: currentPage,
            currentPage: currentPage,
            // Update progress percentage based on pages read
            progress: Math.round((currentPage / totalPages) * 100)
          });
        } catch (error) {
          console.warn('Failed to save reading progress:', error);
        }
      };
      
      // Debounce progress saving
      const timeoutId = setTimeout(saveProgress, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [bookData, bookId, currentPage, totalPages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const renderTasks = renderTasksRef.current;
      const renderQueue = renderQueueRef.current;
      
      renderTasks.forEach(task => {
        if (task) {
          try {
            task.cancel();
          } catch (e) {
            console.warn('Error cancelling render task:', e);
          }
        }
      });
      renderTasks.clear();
      renderQueue.clear();
      
      // Note: pdfDoc cleanup is handled by usePdfLoader to prevent double destruction
    };
  }, []); // Empty dependency array since we only want this on unmount
  
  // Handle zoom change
  const handleZoomChange = (value: string) => {
    setZoomSelect(value);
    if (value === 'auto' || value === 'page-fit') {
      // Will be calculated in renderPage
    } else {
      setScale(parseInt(value) / 100);
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

  // Event handlers for highlights
  const handleAddHighlight = (color: string) => {
    addHighlight(color, pagesRef);
    closeContextMenu();
  };

  const handleDeleteHighlight = (highlightId: string) => {
    deleteHighlight(highlightId);
    closeContextMenu();
  };

  const handleCopyText = (text: string) => {
    copyText(text);
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
  
  const bookTitle = bookData?.title || `PDF Viewer - Book ${bookId}`;

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
        zoomOptions={ZOOM_OPTIONS}
        zoomSelect={zoomSelect}
        handleZoomChange={handleZoomChange}
        rotateLeft={rotateLeft}
        rotateRight={rotateRight}
        highlightColors={HIGHLIGHT_COLORS}
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
      <PdfContextMenu
        contextMenu={contextMenu}
        highlightColor={highlightColor}
        onClose={closeContextMenu}
        onAddHighlight={handleAddHighlight}
        onDeleteHighlight={handleDeleteHighlight}
        onCopyText={handleCopyText}
      />
    </Box>
  );
};