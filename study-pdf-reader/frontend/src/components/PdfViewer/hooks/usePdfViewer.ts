import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

export const usePdfViewer = (pdfDoc, totalPages, highlights) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [zoomSelect, setZoomSelect] = useState('120');
  const [rotation, setRotation] = useState(0);
  const [pageInput, setPageInput] = useState('1');

  const viewerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<Map<number, any>>(new Map());
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const renderTimeoutsRef = useRef<Map<number, NodeJS.Timeout>>(new Map());
  const textSelectionActiveRef = useRef(false);

  const applyHighlightsToPage = useCallback((pageNum: number, highlightsArray: any[]) => {
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo || !pageInfo.textLayer) return;

    const pageHighlights = highlightsArray.filter(h => h.pageNumber === pageNum);
    const existingHighlights = pageInfo.textLayer.querySelectorAll('.highlight');
    existingHighlights.forEach(el => el.remove());

    const fragment = document.createDocumentFragment();
    pageHighlights.forEach((highlight) => {
      highlight.rects.forEach((rect) => {
        const highlightDiv = document.createElement('div');
        highlightDiv.className = 'highlight';
        highlightDiv.setAttribute('data-highlight-id', highlight.id);
        highlightDiv.style.cssText = `position:absolute;left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;background-color:${highlight.color};opacity:0.6;`;
        fragment.appendChild(highlightDiv);
      });
    });
    pageInfo.textLayer.appendChild(fragment);
  }, []);

  const renderPageInternal = useCallback(async (pageNum: number) => {
    if (!pdfDoc) return;
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo) return;

    const renderKey = `${pageNum}-${scale}-${rotation}-${zoomSelect}`;
    if (pageInfo.rendering || (pageInfo.rendered && pageInfo.renderKey === renderKey)) return;

    pageInfo.rendering = true;
    pageInfo.renderKey = renderKey;

    const existingTask = renderTasksRef.current.get(pageNum);
    if (existingTask) existingTask.cancel();

    try {
      const page = await pdfDoc.getPage(pageNum);
      const { canvas, textLayer } = pageInfo;
      const context = canvas.getContext('2d');
      if (!context) return;

      let renderScale = scale;
      if (zoomSelect === 'auto' && viewerRef.current) {
        renderScale = (viewerRef.current.clientWidth - 60) / page.getViewport({ scale: 1, rotation }).width;
      } else if (zoomSelect === 'page-fit' && viewerRef.current) {
        const viewport = page.getViewport({ scale: 1, rotation });
        renderScale = Math.min((viewerRef.current.clientWidth - 60) / viewport.width, (viewerRef.current.clientHeight - 60) / viewport.height);
      }

      const viewport = page.getViewport({ scale: renderScale, rotation });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      Object.assign(canvas.style, { width: `${viewport.width}px`, height: `${viewport.height}px` });
      Object.assign(pageInfo.container.style, { width: `${viewport.width}px`, height: `${viewport.height}px` });
      Object.assign(textLayer.style, { width: `${viewport.width}px`, height: `${viewport.height}px` });

      const renderTask = page.render({ canvasContext: context, viewport });
      renderTasksRef.current.set(pageNum, renderTask);
      await renderTask.promise;

      const textContent = await page.getTextContent();
      textLayer.innerHTML = '';
      textLayer.style.setProperty('--scale-factor', renderScale.toString());
      await pdfjsLib.renderTextLayer({ textContentSource: textContent, container: textLayer, viewport: viewport.clone({ dontFlip: true }) }).promise;
      
      applyHighlightsToPage(pageNum, highlights);
      pageInfo.rendered = true;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') console.error(`Error rendering page ${pageNum}:`, err);
    } finally {
      pageInfo.rendering = false;
      renderTasksRef.current.delete(pageNum);
    }
  }, [pdfDoc, scale, rotation, zoomSelect, highlights, applyHighlightsToPage]);

  const debouncedRenderPage = useCallback((pageNum: number) => {
    if (renderTimeoutsRef.current.has(pageNum)) clearTimeout(renderTimeoutsRef.current.get(pageNum));
    renderTimeoutsRef.current.set(pageNum, setTimeout(() => renderPageInternal(pageNum), 100));
  }, [renderPageInternal]);

  useEffect(() => {
    if (!pdfDoc || !viewerRef.current) return;

    const viewer = viewerRef.current;
    viewer.innerHTML = '';
    pagesRef.current.clear();

    let updateTimeout: NodeJS.Timeout;
    
    observerRef.current = new IntersectionObserver((entries) => {
      let topMostVisiblePage = null;
      let topMostPosition = Infinity;
      
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
          if (pageNum > 0) {
            debouncedRenderPage(pageNum);
            
            // Track the topmost visible page for current page updates
            const rect = entry.boundingClientRect;
            if (rect.top < topMostPosition && rect.top >= -50) {
              topMostPosition = rect.top;
              topMostVisiblePage = pageNum;
            }
          }
        }
      });
      
      // Be much more conservative about page updates
      if (topMostVisiblePage && 
          topMostVisiblePage !== currentPage && 
          !textSelectionActiveRef.current &&
          Math.abs(topMostVisiblePage - currentPage) <= 1) { // Only update if adjacent pages
        console.log('📄 Page update detected:', {
          from: currentPage,
          to: topMostVisiblePage,
          selectionActive: textSelectionActiveRef.current
        });
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
          // Double-check selection state before updating
          const selection = window.getSelection();
          console.log('🔍 Double-checking selection before page update:', {
            hasSelection: !!selection,
            text: selection?.toString()
          });
          if (!selection || !selection.toString().trim()) {
            console.log('✅ Updating page from', currentPage, 'to', topMostVisiblePage);
            setCurrentPage(topMostVisiblePage);
            setPageInput(topMostVisiblePage.toString());
          } else {
            console.log('⚠️ Skipping page update due to active selection');
          }
        }, 1000); // Very long throttle to reduce re-renders
      }
    }, { 
      root: viewerRef.current, 
      rootMargin: '50px',
      threshold: 0.3 
    });

    for (let i = 1; i <= totalPages; i++) {
      const pageInfo = createPageElement(i);
      viewer.appendChild(pageInfo.container);
      pagesRef.current.set(i, pageInfo);
      observerRef.current.observe(pageInfo.container);
    }

    return () => {
      observerRef.current?.disconnect();
      clearTimeout(updateTimeout);
    };
  }, [pdfDoc, totalPages, debouncedRenderPage]);

  useEffect(() => {
    // Only apply highlights when we actually have highlights
    if (highlights.length > 0) {
      console.log('🎨 Highlights useEffect triggered:', {
        highlightCount: highlights.length,
        currentPage,
        totalPages
      });
      // Debounce highlight application to avoid interfering with text selection
      const timeoutId = setTimeout(() => {
        // Only apply to visible pages to avoid re-rendering all pages
        const visiblePages = Array.from(pagesRef.current.keys()).slice(
          Math.max(1, currentPage - 2), 
          Math.min(totalPages + 1, currentPage + 3)
        );
        console.log('🖌️ Applying highlights to visible pages:', visiblePages);
        visiblePages.forEach(pageNum => applyHighlightsToPage(pageNum, highlights));
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [highlights, applyHighlightsToPage, currentPage, totalPages]);

  const scrollToPage = (pageNum: number) => {
    pagesRef.current.get(pageNum)?.container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Track text selection to prevent page updates during selection
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const hasSelection = !!(selection && (selection.toString().trim() || selection.rangeCount > 0));
      const wasActive = textSelectionActiveRef.current;
      textSelectionActiveRef.current = hasSelection;
      
      if (wasActive !== hasSelection) {
        console.log('🎯 Text selection state changed:', {
          from: wasActive,
          to: hasSelection,
          text: selection?.toString() || 'none',
          rangeCount: selection?.rangeCount || 0
        });
      }
    };

    // More frequent checking during text operations
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleSelectionChange);
    document.addEventListener('mouseup', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleSelectionChange);
      document.removeEventListener('mouseup', handleSelectionChange);
    };
  }, []);

  const createPageElement = (pageNum: number) => {
    const container = document.createElement('div');
    container.className = 'page-container';
    container.setAttribute('data-page', pageNum.toString());
    container.style.cssText = 'position: relative; margin: 0 auto 20px auto; background: white; display: flex; justify-content: center; align-items: center; min-height: 400px; page-break-inside: avoid;';
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'display: block; max-width: 100%; height: auto;';
    const textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    const annotationLayer = document.createElement('div');
    annotationLayer.className = 'annotationLayer';
    container.append(canvas, textLayer, annotationLayer);
    return { pageNumber: pageNum, canvas, textLayer, annotationLayer, container };
  };

  return { viewerRef, currentPage, setCurrentPage, pageInput, setPageInput, scale, setScale, zoomSelect, setZoomSelect, rotation, setRotation, scrollToPage, pagesRef };
};
