import { useState, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { Highlight, PageRenderInfo } from '../types';

export const useHighlights = () => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightColor, setHighlightColor] = useState('#FFFF00');

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
  }, []);

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
    applyHighlights,
    applyHighlightsToPage,
    addHighlight,
    deleteHighlight,
  };
};