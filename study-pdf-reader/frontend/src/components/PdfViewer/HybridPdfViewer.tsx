import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Button, Typography, CircularProgress } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs-dist/pdf.worker.min.js';

// Direct book mapping
const bookFileMap: Record<string, string> = {
  'book-1': 'sample-ml-book.pdf',
  'book-2': 'operating-systems-book.pdf', 
  'book-3': 'multipage-sample.pdf',
  'book-4': 'CNSIA.pdf'
};

export const HybridPdfViewer: React.FC = () => {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const viewerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [isLoading, setIsLoading] = useState(true);
  const [highlights, setHighlights] = useState<any[]>([]);

  const handleBack = () => {
    navigate('/dashboard');
  };

  // Load PDF directly without MSW interference
  useEffect(() => {
    if (!bookId || !bookFileMap[bookId]) return;

    const loadPdf = async () => {
      try {
        setIsLoading(true);
        const pdfPath = `/sample-pdfs/${bookFileMap[bookId]}`;
        console.log(`[HYBRID PDF] Loading: ${pdfPath}`);

        const loadingTask = pdfjsLib.getDocument({
          url: pdfPath,
          cMapUrl: '/pdfjs-dist/cmaps/',
          cMapPacked: true,
        });

        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setIsLoading(false);
        console.log(`[HYBRID PDF] Loaded successfully: ${pdf.numPages} pages`);
      } catch (error) {
        console.error('[HYBRID PDF] Load error:', error);
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [bookId]);

  // Render current page
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || !viewerRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Clear previous content
      viewerRef.current.innerHTML = '';

      // Create page container
      const pageContainer = document.createElement('div');
      pageContainer.style.cssText = `
        position: relative;
        margin: 20px auto;
        width: ${viewport.width}px;
        height: ${viewport.height}px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        background: white;
      `;

      // Create canvas for PDF rendering
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.cssText = 'display: block;';
      
      const context = canvas.getContext('2d');
      if (!context) return;

      // Create text layer for text selection
      const textLayer = document.createElement('div');
      textLayer.className = 'textLayer';
      textLayer.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
        opacity: 0.3;
        line-height: 1;
        z-index: 2;
        pointer-events: auto;
        user-select: text;
      `;

      // Create highlight layer
      const highlightLayer = document.createElement('div');
      highlightLayer.className = 'highlightLayer';
      highlightLayer.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 3;
        pointer-events: none;
      `;

      pageContainer.appendChild(canvas);
      pageContainer.appendChild(textLayer);
      pageContainer.appendChild(highlightLayer);
      viewerRef.current.appendChild(pageContainer);

      // Render PDF to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      await page.render(renderContext).promise;

      // Render text layer for selection
      const textContent = await page.getTextContent();
      const textItems = textContent.items as any[];
      
      textItems.forEach((item: any) => {
        if (!item.str) return;
        
        const textSpan = document.createElement('span');
        textSpan.textContent = item.str;
        textSpan.style.cssText = `
          position: absolute;
          color: transparent;
          white-space: pre;
          cursor: text;
          user-select: text;
          pointer-events: auto;
          left: ${item.transform[4]}px;
          top: ${viewport.height - item.transform[5]}px;
          font-size: ${Math.abs(item.transform[3])}px;
          transform-origin: 0 0;
        `;
        textLayer.appendChild(textSpan);
      });

      // Add context menu for highlighting
      textLayer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleTextContextMenu(e, highlightLayer, viewport);
      });

      console.log(`[HYBRID PDF] Page ${pageNum} rendered successfully`);
    } catch (error) {
      console.error(`[HYBRID PDF] Error rendering page ${pageNum}:`, error);
    }
  }, [pdfDoc, scale]);

  // Handle text selection and highlighting
  const handleTextContextMenu = (e: MouseEvent, highlightLayer: HTMLElement, viewport: any) => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') return;

    // Create context menu
    const menu = document.createElement('div');
    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      z-index: 1000;
      padding: 8px 0;
    `;

    const colors = ['yellow', 'lightgreen', 'lightblue', 'pink'];
    colors.forEach(color => {
      const item = document.createElement('div');
      item.textContent = `Highlight ${color}`;
      item.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        background: ${color};
        margin: 2px 8px;
        border-radius: 2px;
      `;
      item.onclick = () => {
        highlightSelection(selection, color, highlightLayer);
        document.body.removeChild(menu);
      };
      menu.appendChild(item);
    });

    // Remove menu on click outside
    const removeMenu = () => {
      if (document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
      document.removeEventListener('click', removeMenu);
    };
    setTimeout(() => document.addEventListener('click', removeMenu), 100);

    document.body.appendChild(menu);
  };

  // Create highlight overlay
  const highlightSelection = (selection: Selection, color: string, highlightLayer: HTMLElement) => {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const viewerRect = viewerRef.current?.getBoundingClientRect();
    
    if (!viewerRect) return;

    const highlight = document.createElement('div');
    highlight.style.cssText = `
      position: absolute;
      left: ${rect.left - viewerRect.left}px;
      top: ${rect.top - viewerRect.top}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background: ${color};
      opacity: 0.6;
      pointer-events: auto;
      cursor: pointer;
      border-radius: 2px;
    `;
    
    // Add delete functionality
    highlight.onclick = (e) => {
      e.preventDefault();
      if (confirm('Delete highlight?')) {
        highlightLayer.removeChild(highlight);
      }
    };

    highlightLayer.appendChild(highlight);
    
    // Save highlight
    const newHighlight = {
      id: Date.now(),
      text: selection.toString(),
      color,
      position: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    };
    setHighlights(prev => [...prev, newHighlight]);
    
    selection.removeAllRanges();
  };

  // Render current page when it changes
  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, scale, renderPage]);

  if (!bookId || !bookFileMap[bookId]) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">PDF not found for book ID: {bookId}</Typography>
        <Button variant="contained" startIcon={<ArrowBack />} onClick={handleBack} sx={{ mt: 2 }}>
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: 2, backgroundColor: '#525659' }}>
        <CircularProgress size={48} sx={{ color: 'white' }} />
        <Typography variant="h6" sx={{ color: 'white' }}>Loading PDF...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#525659' }}>
      {/* Toolbar */}
      <Box sx={{ p: 2, backgroundColor: '#404040', display: 'flex', alignItems: 'center', gap: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={handleBack} sx={{ color: 'white', borderColor: 'white' }}>
          Back
        </Button>
        <Typography variant="h6" sx={{ color: 'white', flexGrow: 1 }}>
          PDF Viewer - {bookFileMap[bookId]} (Page {currentPage} of {totalPages})
        </Typography>
        
        {/* Navigation */}
        <Button variant="outlined" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)} sx={{ color: 'white', borderColor: 'white' }}>
          Previous
        </Button>
        <Button variant="outlined" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} sx={{ color: 'white', borderColor: 'white' }}>
          Next
        </Button>
        
        {/* Zoom */}
        <Button variant="outlined" onClick={() => setScale(s => Math.max(0.5, s - 0.2))} sx={{ color: 'white', borderColor: 'white' }}>
          Zoom -
        </Button>
        <Typography sx={{ color: 'white', minWidth: '60px', textAlign: 'center' }}>
          {Math.round(scale * 100)}%
        </Typography>
        <Button variant="outlined" onClick={() => setScale(s => Math.min(3, s + 0.2))} sx={{ color: 'white', borderColor: 'white' }}>
          Zoom +
        </Button>
      </Box>

      {/* PDF Viewer */}
      <Box ref={viewerRef} sx={{ flexGrow: 1, overflow: 'auto', p: 2, backgroundColor: '#666' }} />
      
      {/* Instructions */}
      <Box sx={{ p: 1, backgroundColor: '#404040', color: 'white', textAlign: 'center', fontSize: '12px' }}>
        Right-click on selected text to highlight • Click highlights to delete • Text selection works perfectly at all zoom levels
      </Box>
    </Box>
  );
};