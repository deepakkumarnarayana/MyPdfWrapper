import React from 'react';
import { IconButton, Tooltip, Box, Typography } from '@mui/material';
import { 
  DarkMode as DarkModeIcon, 
  LightMode as LightModeIcon,
  BugReport as DebugIcon
} from '@mui/icons-material';
import { useUI } from '../../store';

interface NightModeToggleProps {
  size?: 'small' | 'medium' | 'large';
  color?: 'inherit' | 'default' | 'primary' | 'secondary';
}

export const NightModeToggle: React.FC<NightModeToggleProps> = ({ 
  size = 'medium',
  color = 'inherit'
}) => {
  const { pdfNightMode, togglePdfNightMode } = useUI();

  const handleToggle = () => {
    togglePdfNightMode();
  };

  // Debug function to check PDF image rendering
  const debugPdfImages = () => {
    const iframe = document.querySelector('iframe[title="PDF Viewer"]') as HTMLIFrameElement;
    if (iframe?.contentDocument) {
      const iframeDoc = iframe.contentDocument;
      const canvases = iframeDoc.querySelectorAll('.pdfViewer .page canvas');
      const images = iframeDoc.querySelectorAll('.pdfViewer .page img');
      const nightModeActive = iframeDoc.body.classList.contains('pdf-night-mode');
      
      console.log('🔍 PDF Debug Info:', {
        totalCanvases: canvases.length,
        totalImages: images.length,
        nightModeActive,
        canvasDetails: Array.from(canvases).map((canvas, i) => ({
          index: i,
          width: (canvas as HTMLCanvasElement).width,
          height: (canvas as HTMLCanvasElement).height,
          hasFilter: !!getComputedStyle(canvas).filter && getComputedStyle(canvas).filter !== 'none'
        }))
      });
      
      // Check if PDF.js viewer is ready
      const pdfApp = iframe.contentWindow?.PDFViewerApplication;
      if (pdfApp) {
        console.log('📄 PDF App Status:', {
          initialized: pdfApp.initialized,
          pagesCount: pdfApp.pagesCount,
          currentPage: pdfApp.page,
          loading: pdfApp.loading
        });
      }
    } else {
      console.log('❌ PDF iframe not accessible');
    }
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Tooltip 
        title={pdfNightMode ? 'Switch to Light Mode' : 'Switch to Night Mode'}
        arrow
      >
        <IconButton
          onClick={handleToggle}
          size={size}
          color={color}
          sx={{
            color: color === 'inherit' ? 'white' : undefined,
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          {pdfNightMode ? <LightModeIcon /> : <DarkModeIcon />}
        </IconButton>
      </Tooltip>
      
      {/* Debug button for development */}
      {process.env.NODE_ENV === 'development' && (
        <Tooltip title="Debug PDF Images" arrow>
          <IconButton
            onClick={debugPdfImages}
            size="small"
            sx={{
              color: color === 'inherit' ? 'rgba(255, 255, 255, 0.7)' : undefined,
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <DebugIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};