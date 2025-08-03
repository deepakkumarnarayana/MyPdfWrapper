import { useState, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { StoredHighlight, PageRenderInfo, HighlightSettings } from '../types';
import { DEFAULT_HIGHLIGHT_SETTINGS } from '../constants';
import { clientToPagePoint } from '../utils/coordinates';

// Helper to apply a transform to a point
const applyTransform = (point: [number, number], transform: number[]): [number, number] => {
  const [x, y] = point;
  const [a, b, c, d, e, f] = transform;
  return [a * x + c * y + e, b * x + d * y + f];
};

export const useHighlights = () => {
  const [highlights, setHighlights] = useState<StoredHighlight[]>([]);
  const [highlightColor, setHighlightColor] = useState('#FFFF00');
  const [highlightSettings, setHighlightSettings] = useState<HighlightSettings>(DEFAULT_HIGHLIGHT_SETTINGS);

  const updateHighlightSettings = useCallback((newSettings: Partial<HighlightSettings>) => {
    setHighlightSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const applyHighlightsToPage = useCallback((
    pageNum: number,
    pagesRef: MutableRefObject<Map<number, PageRenderInfo>>,
    onHighlightContextMenu?: (event: MouseEvent, highlightId: string, text: string) => void
  ) => {
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo || !pageInfo.viewport || !pageInfo.annotationLayer) return;

    const { viewport, annotationLayer } = pageInfo;
    const highlightsToApply = highlights;

    const containerId = `highlight-container-${pageNum}`;
    let container = annotationLayer.querySelector(`#${containerId}`);
    if (container) {
      container.innerHTML = '';
    } else {
      container = document.createElement('div');
      container.id = containerId;
      annotationLayer.appendChild(container);
    }

    if (!highlightSettings.showAll) return;

    highlightsToApply
      .filter(h => h.pageNumber === pageNum && h.visible !== false)
      .forEach(highlight => {
        highlight.rects.forEach((rect) => {
          const [x1, y1] = applyTransform([rect.x, rect.y], viewport.transform);
          const [x2, y2] = applyTransform([rect.x + rect.width, rect.y + rect.height], viewport.transform);

          const highlightDiv = document.createElement('div');
          highlightDiv.className = 'highlight';
          highlightDiv.setAttribute('data-highlight-id', highlight.id);
          
          highlightDiv.style.cssText = `
            position: absolute;
            left: ${Math.min(x1, x2)}px;
            top: ${Math.min(y1, y2)}px;
            width: ${Math.abs(x2 - x1)}px;
            height: ${Math.abs(y2 - y1)}px;
            background-color: ${highlight.color};
            mix-blend-mode: multiply;
            pointer-events: auto;
            cursor: pointer;
            opacity: ${highlight.opacity ?? highlightSettings.opacity * 0.4};
          `.replace(/\s+/g, ' ').trim();

          if (onHighlightContextMenu) {
            highlightDiv.addEventListener('contextmenu', (e) => {
              e.preventDefault();
              e.stopPropagation();
              onHighlightContextMenu(e, highlight.id, highlight.text);
            });
          }
          container!.appendChild(highlightDiv);
        });
      });
  }, [highlights, highlightSettings]);

  const addHighlight = useCallback((
    color: string,
    pagesRef: MutableRefObject<Map<number, PageRenderInfo>>
  ) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const pageContainer = range.commonAncestorContainer.parentElement?.closest('.page-container');
    if (!pageContainer) return;

    const pageNum = parseInt(pageContainer.getAttribute('data-page') || '0', 10);
    const pageInfo = pagesRef.current.get(pageNum);
    if (!pageInfo) return;

    const rects = Array.from(range.getClientRects()).map(clientRect => {
      const { x: x1, y: y1 } = clientToPagePoint(pageInfo, clientRect.left, clientRect.top);
      const { x: x2, y: y2 } = clientToPagePoint(pageInfo, clientRect.right, clientRect.bottom);
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      };
    });

    if (rects.length === 0) return;

    const newHighlight: StoredHighlight = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      pageNumber: pageNum,
      rects,
      color,
      text: selection.toString(),
      timestamp: new Date(),
      visible: true,
    };

    setHighlights(prev => [...prev, newHighlight]);
    selection.removeAllRanges();
  }, []);

  const deleteHighlight = useCallback((highlightId: string) => {
    setHighlights(prev => prev.filter(h => h.id !== highlightId));
  }, []);

  return {
    highlights,
    highlightColor,
    setHighlightColor,
    highlightSettings,
    updateHighlightSettings,
    applyHighlights: applyHighlightsToPage,
    addHighlight,
    deleteHighlight,
  };
};