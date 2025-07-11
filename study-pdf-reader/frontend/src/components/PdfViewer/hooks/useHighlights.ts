import { useState, useCallback, useEffect } from 'react';

export interface Highlight {
  id: string;
  pageNumber: number;
  rects: { x: number; y: number; width: number; height: number }[];
  color: string;
  text: string;
  timestamp: Date;
}

export interface ContextMenuState {
  mouseX: number;
  mouseY: number;
  text: string;
  highlightId?: string;
}

export const useHighlights = (pagesRef) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [storedSelection, setStoredSelection] = useState<{ text: string; pageNum: number } | null>(null);
  const [selectionRestoreRef, setSelectionRestoreRef] = useState<{ range: Range } | null>(null);

  // Restore selection after context menu state changes
  useEffect(() => {
    console.log('📋 Context menu state changed:', contextMenu ? 'OPEN' : 'CLOSED');
    
    // Restore selection when context menu opens
    if (contextMenu && selectionRestoreRef) {
      setTimeout(() => {
        try {
          const selection = window.getSelection();
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(selectionRestoreRef.range);
            console.log('🔄 Selection restored after context menu opened');
          }
        } catch (error) {
          console.log('⚠️ Could not restore selection:', error);
        }
      }, 10);
    }
  }, [contextMenu]);

  const addHighlight = useCallback((color: string) => {
    console.log('🎨 ADD HIGHLIGHT CALLED with color:', color);
    
    // Use current selection instead of stored range since DOM might have changed
    const selection = window.getSelection();
    console.log('📝 Current selection during addHighlight:', {
      hasSelection: !!selection,
      text: selection?.toString(),
      rangeCount: selection?.rangeCount,
      type: selection?.type,
      storedText: storedSelection?.text
    });
    
    if (selection && selection.toString().trim() && selection.rangeCount > 0) {
      console.log('💾 Using current selection for highlighting');
      
      try {
        const range = selection.getRangeAt(0);
        const text = selection.toString().trim();
        
        // Find the page number for this selection
        let element = range.commonAncestorContainer;
        let pageNum = storedSelection?.pageNum || 1;
        
        while (element && element !== document.body) {
          if (element.nodeType === Node.ELEMENT_NODE) {
            const pageContainer = (element as Element).closest('.page-container');
            if (pageContainer) {
              pageNum = parseInt(pageContainer.getAttribute('data-page') || '1');
              break;
            }
          }
          element = element.parentNode as Node;
        }
        
        // Find the text layer from the detected page number
        const pageInfo = pagesRef.current.get(pageNum);
        if (!pageInfo || !pageInfo.textLayer) {
          console.log('❌ Could not find page info for selection');
          return;
        }
        
        const textLayer = pageInfo.textLayer;
        const textLayerRect = textLayer.getBoundingClientRect();
        const rects = Array.from(range.getClientRects()).map(rect => ({
          x: rect.left - textLayerRect.left,
          y: rect.top - textLayerRect.top,
          width: rect.width,
          height: rect.height,
        }));

        if (rects.length === 0) {
          console.log('❌ No rects found for current selection');
          return;
        }

        const newHighlight: Highlight = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          pageNumber: pageNum,
          rects,
          color,
          text,
          timestamp: new Date(),
        };

        console.log('✅ Adding highlight from current selection:', newHighlight);
        setHighlights(prev => [...prev, newHighlight]);
        
        // Clear stored selection and context menu
        setStoredSelection(null);
        setContextMenu(null);
        
      } catch (error) {
        console.error('Error adding highlight from current selection:', error);
        setStoredSelection(null);
        setContextMenu(null);
      }
      
    } else {
      console.log('❌ No selection available for highlighting');
    }
  }, [pagesRef, storedSelection]);

  const deleteHighlight = useCallback((highlightId: string) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId));
    setStoredSelection(null);
    setContextMenu(null);
  }, []);

  const closeContextMenu = useCallback(() => {
    console.log('🚪 Closing context menu and clearing stored selection');
    setStoredSelection(null);
    setContextMenu(null);
    setSelectionRestoreRef(null);
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    console.log('🖱️ RIGHT CLICK DETECTED');
    event.preventDefault();
    event.stopPropagation();
    
    const selection = window.getSelection();
    console.log('📝 Selection before context menu:', {
      hasSelection: !!selection,
      text: selection?.toString(),
      rangeCount: selection?.rangeCount,
      type: selection?.type
    });
    
    if (selection && selection.toString().trim() && selection.rangeCount > 0) {
      // Store selection text and range immediately to avoid losing it
      const selectionText = selection.toString().trim();
      const range = selection.getRangeAt(0).cloneRange();
      
      // Find the page number for this selection
      let element = range.commonAncestorContainer;
      let pageNum = 1;
      
      while (element && element !== document.body) {
        if (element.nodeType === Node.ELEMENT_NODE) {
          const pageContainer = (element as Element).closest('.page-container');
          if (pageContainer) {
            pageNum = parseInt(pageContainer.getAttribute('data-page') || '1');
            break;
          }
        }
        element = element.parentNode as Node;
      }
      
      console.log('💾 Storing selection:', { text: selectionText, pageNum });
      setStoredSelection({ text: selectionText, pageNum });
      
      // Also store for visual restoration
      setSelectionRestoreRef({ range: range.cloneRange() });
      
      console.log('✅ Setting context menu with text:', selectionText);
      setContextMenu({
        mouseX: event.clientX,
        mouseY: event.clientY,
        text: selectionText,
      });
    } else {
      console.log('❌ No valid selection found for context menu');
    }
  }, []);

  return {
    highlights,
    highlightColor,
    setHighlightColor,
    contextMenu,
    setContextMenu,
    closeContextMenu,
    addHighlight,
    deleteHighlight,
    handleContextMenu,
    isContextMenuOpen: contextMenu !== null,
  };
};
