import { useState, useCallback } from 'react';

export interface TocItem {
  title: string;
  dest: any;
  pageNumber?: number;
  level: number;
  items?: TocItem[];
  expanded?: boolean;
}

export const useTableOfContents = (
  pdfDoc: any,
  setCurrentPage: (page: number) => void,
  setPageInput: (input: string) => void,
  scrollToPage: (page: number) => void
) => {
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [tocLoading, setTocLoading] = useState(false);

  const extractTableOfContents = useCallback(async (pdf: any) => {
    if (!pdf) return;
    try {
      setTocLoading(true);
      const outline = await pdf.getOutline();
      
      if (outline && outline.length > 0) {
        const processOutlineItems = async (items: any[], level: number = 0): Promise<TocItem[]> => {
          const tocItems: TocItem[] = [];
          for (const item of items) {
            const tocItem: TocItem = {
              title: item.title,
              dest: item.dest,
              level,
              expanded: level < 2,
            };
            if (item.dest) {
              try {
                const destArray = typeof item.dest === 'string' 
                  ? await pdf.getDestination(item.dest)
                  : item.dest;
                if (destArray && destArray[0]) {
                  const pageRef = destArray[0];
                  const pageIndex = await pdf.getPageIndex(pageRef);
                  tocItem.pageNumber = pageIndex + 1;
                }
              } catch (error) {
                console.warn('Could not resolve destination for:', item.title);
              }
            }
            if (item.items && item.items.length > 0) {
              tocItem.items = await processOutlineItems(item.items, level + 1);
            }
            tocItems.push(tocItem);
          }
          return tocItems;
        };
        const extractedToc = await processOutlineItems(outline);
        setTocItems(extractedToc);
      } else {
        const simpleToc: TocItem[] = Array.from({ length: pdf.numPages }, (_, i) => ({
          title: `Page ${i + 1}`,
          dest: null,
          pageNumber: i + 1,
          level: 0,
        }));
        setTocItems(simpleToc);
      }
    } catch (error) {
      console.error('Error extracting table of contents:', error);
    } finally {
      setTocLoading(false);
    }
  }, []);

  const toggleToc = () => {
    setIsTocOpen(prev => !prev);
  };

  const handleTocItemClick = useCallback((tocItem: TocItem) => {
    if (tocItem.pageNumber) {
      setCurrentPage(tocItem.pageNumber);
      setPageInput(tocItem.pageNumber.toString());
      scrollToPage(tocItem.pageNumber);
      if (window.innerWidth < 768) {
        setIsTocOpen(false);
      }
    }
  }, [setCurrentPage, setPageInput, scrollToPage]);

  const toggleTocItemExpanded = (items: TocItem[], targetItem: TocItem): TocItem[] => {
    return items.map(item => {
      if (item === targetItem) {
        return { ...item, expanded: !item.expanded };
      }
      if (item.items) {
        return { ...item, items: toggleTocItemExpanded(item.items, targetItem) };
      }
      return item;
    });
  };

  const handleTocItemToggle = useCallback((tocItem: TocItem) => {
    setTocItems(prevItems => toggleTocItemExpanded(prevItems, tocItem));
  }, []);

  return {
    tocItems,
    isTocOpen,
    tocLoading,
    extractTableOfContents,
    toggleToc,
    handleTocItemClick,
    handleTocItemToggle,
  };
};