import { useState, useCallback } from 'react';
import type { MouseEvent } from 'react';
import { ContextMenuState } from '../types';

export const usePdfContextMenu = () => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Handle context menu
  const handleContextMenu = useCallback((event: MouseEvent) => {
    event.preventDefault();
    
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setContextMenu({
        mouseX: event.clientX,
        mouseY: event.clientY,
        text: selection.toString().trim(),
      });
    }
  }, []);

  // Handle highlight context menu
  const handleHighlightContextMenu = useCallback((
    event: globalThis.MouseEvent,
    highlightId: string,
    text: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      text,
      highlightId,
    });
  }, []);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Copy text to clipboard
  const copyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    closeContextMenu();
  }, [closeContextMenu]);

  return {
    contextMenu,
    handleContextMenu,
    handleHighlightContextMenu,
    closeContextMenu,
    copyText,
  };
};