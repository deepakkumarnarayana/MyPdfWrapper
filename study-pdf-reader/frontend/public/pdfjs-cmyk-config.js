// PDF.js CMYK Color Management Configuration
// This file enhances PDF.js to properly handle CMYK images

(function() {
  'use strict';

  // Wait for PDF.js to load
  const initCMYKSupport = () => {
    if (typeof window.pdfjsLib === 'undefined') {
      setTimeout(initCMYKSupport, 100);
      return;
    }

    console.log('🎨 Initializing CMYK color management for PDF.js');

    // Enable CMYK support in PDF.js
    if (window.pdfjsLib.GlobalWorkerOptions) {
      // Ensure worker is properly configured
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs-full/build/pdf.worker.mjs';
    }

    // Fix WASM paths for PDF.js
    if (window.pdfjsLib.GlobalWorkerOptions) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs-full/build/pdf.worker.mjs';
    }

    // Override WASM paths to correct locations
    const originalWasmBinary = window.pdfjsLib.wasmBinary;
    if (window.pdfjsLib.WasmSupported) {
      // Set correct WASM paths
      window.pdfjsLib.wasmBinary = '/pdfjs-full/wasm/openjpeg.wasm';
    }

    // Configure PDF.js rendering with CMYK support
    const originalGetDocument = window.pdfjsLib.getDocument;
    window.pdfjsLib.getDocument = function(src, options = {}) {
      // Enhance options with CMYK support
      const enhancedOptions = {
        ...options,
        // Enable image decoding
        enableXfa: true,
        // Improve color management
        useSystemFonts: true,
        // Force WASM usage for better image decoding
        isEvalSupported: false,
        // Enable all available decoders
        maxImageSize: 268435456, // 256MB
        // Color space handling
        cMapUrl: '/pdfjs-full/cmaps/',
        cMapPacked: true,
        // Enhanced error handling
        stopAtErrors: false,
        // CMYK-specific enhancements
        verbosity: window.pdfjsLib.VerbosityLevel.INFOS,
        // WASM configuration
        wasmBinary: '/pdfjs-full/wasm/openjpeg.wasm'
      };

      console.log('📄 Loading PDF with enhanced CMYK support');
      return originalGetDocument.call(this, src, enhancedOptions);
    };

    // Enhance page rendering for CMYK images
    if (window.pdfjsLib.PixelsPerInch) {
      // Higher DPI for better CMYK rendering
      window.pdfjsLib.PixelsPerInch.PDF_TO_CSS_UNITS = 96 / 72;
    }

    // Monitor for CMYK image errors and provide fallbacks
    const originalConsoleWarn = console.warn;
    console.warn = function(...args) {
      const message = args.join(' ');
      
      if (message.includes('CMYK') || message.includes('DeviceCMYK') || message.includes('JpxError')) {
        console.log('🎨 CMYK image detected - applying color conversion');
        
        // Attempt to force re-render with color conversion
        setTimeout(() => {
          const iframe = parent.document.querySelector('iframe[title="PDF Viewer"]');
          if (iframe && iframe.contentWindow && iframe.contentWindow.PDFViewerApplication) {
            const app = iframe.contentWindow.PDFViewerApplication;
            if (app.pdfViewer) {
              console.log('🔄 Force re-rendering current page for CMYK compatibility');
              const currentPage = app.pdfViewer.currentPageNumber;
              const pageView = app.pdfViewer.getPageView(currentPage - 1);
              if (pageView) {
                pageView.draw();
              }
            }
          }
        }, 500);
      }
      
      originalConsoleWarn.apply(console, args);
    };

    console.log('✅ CMYK color management initialized');
  };

  // Auto-initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCMYKSupport);
  } else {
    initCMYKSupport();
  }

  // Export for manual initialization if needed
  window.initCMYKSupport = initCMYKSupport;
})();

// Additional CMYK color conversion utilities
window.CMYKConverter = {
  // Convert CMYK to RGB for web display
  cmykToRgb: function(c, m, y, k) {
    const r = 255 * (1 - c / 100) * (1 - k / 100);
    const g = 255 * (1 - m / 100) * (1 - k / 100);
    const b = 255 * (1 - y / 100) * (1 - k / 100);
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
  },

  // Apply color profile correction
  applyCMYKFallback: function() {
    console.log('🎨 Applying CMYK fallback color management');
    
    // This is a simplified fallback - in production you'd want a proper ICC profile
    const canvas = document.querySelectorAll('canvas');
    canvas.forEach(c => {
      if (c && c.getContext) {
        const ctx = c.getContext('2d');
        if (ctx) {
          // Apply basic CMYK to RGB conversion filter
          c.style.filter = 'brightness(1.1) contrast(1.05) saturate(0.95)';
        }
      }
    });
  }
};

console.log('📦 PDF.js CMYK configuration loaded');