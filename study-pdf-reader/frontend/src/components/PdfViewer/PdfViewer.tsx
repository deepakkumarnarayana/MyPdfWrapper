import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Button,
  Tooltip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  Menu,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  ArrowBack,
  ZoomIn,
  ZoomOut,
  NavigateBefore,
  NavigateNext,
  FirstPage,
  LastPage,
  Highlight,
  TextFields,
  Palette,
  RotateLeft,
  RotateRight,
} from '@mui/icons-material';
import * as pdfjsLib from 'pdfjs-dist';
// Import official PDF.js viewer CSS for proper text layer styling
import 'pdfjs-dist/web/pdf_viewer.css';

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
    margin: -1px;
    padding: 1px;
    background-color: rgba(180, 0, 170, 1);
    border-radius: 4px;
  }
`;

interface PdfViewerProps {}

interface PageRenderInfo {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  textLayer: HTMLDivElement;
  annotationLayer: HTMLDivElement;
  container: HTMLDivElement;
  scale: number;
  rendered: boolean;
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
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    text: string;
  } | null>(null);
  
  // Refs
  const viewerRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<Map<number, PageRenderInfo>>(new Map());
  const renderTasksRef = useRef<Map<number, any>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const styleRef = useRef<HTMLStyleElement | null>(null);
  
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
    canvas.style.cssText = `
      display: block;
      max-width: 100%;
      height: auto;
    `;
    
    const textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    
    const annotationLayer = document.createElement('div');
    annotationLayer.className = 'annotationLayer';
    
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
      rendered: false,
      textContent: null,
      annotations: [],
    };
  };
  
  // Render page with text and annotation layers
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc) return;
    
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo) return;
    
    // Cancel any existing render task for this page
    const existingTask = renderTasksRef.current.get(pageNum);
    if (existingTask) {
      existingTask.cancel();
    }
    
    try {
      const page = await pdfDoc.getPage(pageNum);
      const { canvas, textLayer, annotationLayer } = pageInfo;
      const context = canvas.getContext('2d');
      
      if (!context) return;
      
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
      
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      const renderTask = page.render(renderContext);
      renderTasksRef.current.set(pageNum, renderTask);
      
      await renderTask.promise;
      
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
          
          console.log(`Text layer rendered for page ${pageNum}, scale: ${renderScale}`);
          
          // Debug: Check if text elements were created
          const textElements = textLayer.querySelectorAll('span');
          console.log(`Created ${textElements.length} text elements`);
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
        annotations.forEach((annotation: any) => {
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
      pageInfo.scale = renderScale;
      renderTasksRef.current.delete(pageNum);
      
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
      if (err instanceof Error && err.message.includes('cancelled')) {
        return;
      }
      renderTasksRef.current.delete(pageNum);
    }
  }, [pdfDoc, scale, zoomSelect, rotation]);
  
  // Apply highlights to page
  const applyHighlights = (pageNum: number) => {
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo) return;
    
    const pageHighlights = highlights.filter(h => h.pageNumber === pageNum);
    
    // Clear existing highlights
    const existingHighlights = pageInfo.textLayer.querySelectorAll('.highlight');
    existingHighlights.forEach(el => el.remove());
    
    pageHighlights.forEach((highlight) => {
      highlight.rects.forEach((rect) => {
        const highlightDiv = document.createElement('div');
        highlightDiv.className = 'highlight';
        highlightDiv.style.cssText = `
          position: absolute;
          left: ${rect.x}px;
          top: ${rect.y}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background-color: ${highlight.color};
          opacity: 0.3;
          pointer-events: none;
          z-index: 1;
        `;
        pageInfo.textLayer.appendChild(highlightDiv);
      });
    });
  };
  
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
  const addHighlight = (color: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) {
      return;
    }
    
    try {
      // Get selection range and page
      const range = selection.getRangeAt(0);
      
      // Find the text layer containing the selection
      let textLayer: Element | null = null;
      let pageContainer: Element | null = null;
      let element = range.commonAncestorContainer;
      
      // Traverse up the DOM tree to find the text layer
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
      
      if (!textLayer) {
        return;
      }
      
      // Find the page container
      pageContainer = textLayer.closest('.page-container');
      if (!pageContainer) {
        return;
      }
      
      let pageNum = parseInt(pageContainer.getAttribute('data-page') || '0');
      if (pageNum === 0) {
        // Try to find page number from page info map
        const foundPage = Array.from(pagesRef.current.entries()).find(([, info]) => 
          info.textLayer === textLayer
        );
        if (!foundPage) {
          return;
        }
        pageNum = foundPage[0];
      }
      
      // Calculate highlight rectangles relative to the text layer
      const rects = Array.from(range.getClientRects()).map(rect => {
        const textLayerRect = textLayer!.getBoundingClientRect();
        return {
          x: rect.left - textLayerRect.left,
          y: rect.top - textLayerRect.top,
          width: rect.width,
          height: rect.height,
        };
      });
      
      if (rects.length === 0) {
        return;
      }
      
      const highlight: Highlight = {
        id: Date.now().toString(),
        pageNumber: pageNum,
        rects,
        color,
        text: selection.toString().trim(),
        timestamp: new Date(),
      };
      
      setHighlights(prev => [...prev, highlight]);
      
      // Apply highlight immediately
      setTimeout(() => {
        applyHighlights(pageNum);
      }, 100);
      
      // Clear selection
      selection.removeAllRanges();
      setContextMenu(null);
      
    } catch (error) {
      console.error('Error adding highlight:', error);
    }
  };
  
  // Setup intersection observer
  useEffect(() => {
    if (!pdfDoc || !viewerRef.current) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page') || '0');
            if (pageNum > 0) {
              renderPage(pageNum);
            }
          }
        });
      },
      {
        root: viewerRef.current,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [pdfDoc, renderPage]);
  
  // Create and render all pages
  useEffect(() => {
    if (!pdfDoc || !viewerRef.current) return;
    
    const viewer = viewerRef.current;
    
    // Clear existing pages
    viewer.innerHTML = '';
    pagesRef.current.clear();
    
    // Create all page elements
    for (let i = 1; i <= totalPages; i++) {
      const pageInfo = createPageElement(i);
      viewer.appendChild(pageInfo.container);
      pagesRef.current.set(i, pageInfo);
      
      // Observe for intersection
      if (observerRef.current) {
        observerRef.current.observe(pageInfo.container);
      }
    }
    
    // Render first few pages immediately
    for (let i = 1; i <= Math.min(3, totalPages); i++) {
      renderPage(i);
    }
    
  }, [pdfDoc, totalPages, renderPage]);
  
  // Re-render pages when scale or rotation changes
  useEffect(() => {
    if (!pdfDoc) return;
    
    // Mark all pages as not rendered
    pagesRef.current.forEach(pageInfo => {
      pageInfo.rendered = false;
    });
    
    // Re-render visible pages
    const visiblePages = Array.from(pagesRef.current.keys()).slice(0, 5);
    visiblePages.forEach(pageNum => {
      renderPage(pageNum);
    });
    
  }, [scale, zoomSelect, rotation, renderPage]);
  
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
  
  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Main Toolbar */}
      <AppBar position="static" elevation={0} sx={{ backgroundColor: '#474747', color: 'white' }}>
        <Toolbar sx={{ minHeight: '48px !important', py: 0 }}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleBack}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          
          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: '1rem' }}>
            PDF Viewer - Book {bookId}
          </Typography>
          
          {/* Page Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="First Page">
              <span>
                <IconButton color="inherit" onClick={goToFirstPage} disabled={currentPage === 1} size="small">
                  <FirstPage />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Previous Page">
              <span>
                <IconButton color="inherit" onClick={goToPreviousPage} disabled={currentPage === 1} size="small">
                  <NavigateBefore />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Next Page">
              <span>
                <IconButton color="inherit" onClick={goToNextPage} disabled={currentPage === totalPages} size="small">
                  <NavigateNext />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Last Page">
              <span>
                <IconButton color="inherit" onClick={goToLastPage} disabled={currentPage === totalPages} size="small">
                  <LastPage />
                </IconButton>
              </span>
            </Tooltip>
            
            <TextField
              size="small"
              value={pageInput}
              onChange={handlePageInputChange}
              onKeyPress={(e) => e.key === 'Enter' && handlePageInputSubmit()}
              onBlur={handlePageInputSubmit}
              sx={{ 
                width: 50,
                '& .MuiInputBase-root': { 
                  height: 32,
                  color: 'white',
                  '& input': { textAlign: 'center', p: 0.5 }
                },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }
              }}
            />
            <Typography variant="body2" sx={{ mx: 1 }}>
              of {totalPages}
            </Typography>
          </Box>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.3)' }} />
          
          {/* Zoom Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Zoom Out">
              <span>
                <IconButton 
                  color="inherit" 
                  onClick={() => {
                    const currentIndex = zoomOptions.findIndex(opt => opt.value === zoomSelect);
                    if (currentIndex > 0) {
                      handleZoomChange(zoomOptions[currentIndex - 1]?.value || '25');
                    }
                  }}
                  disabled={zoomSelect === '25'}
                  size="small"
                >
                  <ZoomOut />
                </IconButton>
              </span>
            </Tooltip>
            
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <Select
                value={zoomSelect}
                onChange={(e) => handleZoomChange(e.target.value)}
                sx={{
                  color: 'white',
                  height: 32,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                  '& .MuiSvgIcon-root': { color: 'white' }
                }}
              >
                {zoomOptions.map(option => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Tooltip title="Zoom In">
              <span>
                <IconButton 
                  color="inherit" 
                  onClick={() => {
                    const currentIndex = zoomOptions.findIndex(opt => opt.value === zoomSelect);
                    if (currentIndex < zoomOptions.length - 3) {
                      handleZoomChange(zoomOptions[currentIndex + 1]?.value || '400');
                    }
                  }}
                  disabled={zoomSelect === '400'}
                  size="small"
                >
                  <ZoomIn />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.3)' }} />
          
          {/* Rotation Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Rotate Left">
              <IconButton color="inherit" onClick={rotateLeft} size="small">
                <RotateLeft />
              </IconButton>
            </Tooltip>
            <Tooltip title="Rotate Right">
              <IconButton color="inherit" onClick={rotateRight} size="small">
                <RotateRight />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.3)' }} />
          
          {/* Highlight Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Highlight Color">
              <IconButton color="inherit" size="small">
                <Palette />
              </IconButton>
            </Tooltip>
            {highlightColors.map(color => (
              <Box
                key={color}
                sx={{
                  width: 20,
                  height: 20,
                  backgroundColor: color,
                  border: highlightColor === color ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  '&:hover': {
                    opacity: 0.8,
                  }
                }}
                onClick={() => setHighlightColor(color)}
              />
            ))}
          </Box>
        </Toolbar>
      </AppBar>
      
      {/* PDF Viewer */}
      <Box
        ref={viewerRef}
        onContextMenu={handleContextMenu}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          backgroundColor: '#525659',
          p: 2,
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
      >
        <MenuItem onClick={() => addHighlight(highlightColor)}>
          <ListItemIcon>
            <Highlight sx={{ color: highlightColor }} />
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
      </Menu>
    </Box>
  );
};