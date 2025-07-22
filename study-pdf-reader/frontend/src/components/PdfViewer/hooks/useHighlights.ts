import { useState, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { Highlight, PageRenderInfo, HighlightSettings } from '../types';
import { DEFAULT_HIGHLIGHT_SETTINGS } from '../constants';

export const useHighlights = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [highlightSettings, setHighlightSettings] = useState<HighlightSettings>(DEFAULT_HIGHLIGHT_SETTINGS);

  // Update highlight settings
  const updateHighlightSettings = useCallback((newSettings: Partial<HighlightSettings>) => {
    setHighlightSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  // Apply highlights to a specific page
  const applyHighlightsToPage = useCallback((
    pageNum: number, 
    highlightsArray: Highlight[],
    pagesRef: MutableRefObject<Map<number, PageRenderInfo>>,
    onHighlightContextMenu?: (event: globalThis.MouseEvent, highlightId: string, text: string) => void
  ) => {
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo) return;
    
    const pageHighlights = highlightsArray.filter(h => h.pageNumber === pageNum);
    
    // Clear existing highlights efficiently
    const existingHighlights = pageInfo.textLayer.querySelectorAll('.highlight');
    existingHighlights.forEach(el => el.remove());
    
    // If showAll is false, don't render any highlights
    if (!highlightSettings.showAll) return;
    
    // Create document fragment for batch DOM insertion
    const fragment = document.createDocumentFragment();
    
    pageHighlights.forEach((highlight) => {
      // Skip hidden highlights
      if (highlight.visible === false && highlight.visible !== undefined) return;
      
      highlight.rects.forEach((rect) => {
        const highlightDiv = document.createElement('div');
        highlightDiv.className = 'highlight';
        highlightDiv.setAttribute('data-highlight-id', highlight.id);
        highlightDiv.title = `"${highlight.text}" - Right-click to delete`;
        
        // Use highlight-specific settings or fall back to global settings
        const opacity = highlight.opacity !== undefined ? highlight.opacity : highlightSettings.opacity * 0.3;
        const thickness = highlight.thickness !== undefined ? highlight.thickness : highlightSettings.thickness;
        const color = highlight.color;
        
        // Enhanced styles with new settings support
        const borderWidth = Math.max(1, Math.round(thickness / 8));
        highlightDiv.style.cssText = `
          position: absolute;
          left: ${rect.x}px;
          top: ${rect.y}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          background-color: ${color};
          opacity: ${opacity};
          pointer-events: auto;
          z-index: 4;
          cursor: pointer;
          border: ${borderWidth}px solid ${color};
          border-radius: ${Math.min(2, thickness / 4)}px;
          box-shadow: 0 0 ${thickness / 2}px rgba(0, 0, 0, 0.1);
          transition: opacity 0.2s ease, transform 0.1s ease;
        `.replace(/\s+/g, ' ').trim();
        
        // Add hover effects
        highlightDiv.addEventListener('mouseenter', () => {
          highlightDiv.style.opacity = String(Math.min(1, opacity + 0.2));
          highlightDiv.style.transform = 'scale(1.02)';
        });
        
        highlightDiv.addEventListener('mouseleave', () => {
          highlightDiv.style.opacity = String(opacity);
          highlightDiv.style.transform = 'scale(1)';
        });
        
        // Add right-click handler for deletion if provided
        if (onHighlightContextMenu) {
          highlightDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            onHighlightContextMenu(e, highlight.id, highlight.text);
          });
        }
        
        fragment.appendChild(highlightDiv);
      });
    });
    
    // Single DOM insertion
    pageInfo.textLayer.appendChild(fragment);
  }, [highlightSettings]);

  // Apply highlights to page using current state  
  const applyHighlights = useCallback((
    pageNum: number,
    pagesRef: MutableRefObject<Map<number, PageRenderInfo>>,
    onHighlightContextMenu?: (event: globalThis.MouseEvent, highlightId: string, text: string) => void
  ) => {
    applyHighlightsToPage(pageNum, highlights, pagesRef, onHighlightContextMenu);
  }, [highlights, applyHighlightsToPage]);

  // Add highlight from text selection
  const addHighlight = useCallback((
    color: string,
    pagesRef: MutableRefObject<Map<number, PageRenderInfo>>
  ) => {
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
        opacity: highlightSettings.opacity,
        thickness: highlightSettings.thickness,
        type: 'text',
        visible: true,
      };
      
      setHighlights(prev => [...prev, highlight]);
      
      // Clear selection
      selection.removeAllRanges();
      
    } catch (error) {
      console.error('Error adding highlight:', error);
    }
  }, []);

  // Delete highlight
  const deleteHighlight = useCallback((highlightId: string) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId));
  }, []);

  return {
    highlights,
    highlightColor,
    setHighlightColor,
    highlightSettings,
    updateHighlightSettings,
    applyHighlights,
    applyHighlightsToPage,
    addHighlight,
    deleteHighlight,
  };
};