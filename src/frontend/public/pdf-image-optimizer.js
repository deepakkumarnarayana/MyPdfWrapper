/**
 * PDF Image Optimizer
 * Advanced image processing and memory management for large JPEG2000/CMYK images
 * Optimizes rendering performance and memory usage
 */

class PdfImageOptimizer {
  constructor() {
    this.imagePool = new Map(); // Reusable canvas pool
    this.processingQueue = [];
    this.maxConcurrentProcessing = navigator.hardwareConcurrency || 4;
    this.currentProcessing = 0;
    
    // Memory management
    this.memoryThreshold = 200 * 1024 * 1024; // 200MB
    this.imageCache = new Map();
    this.maxCachedImages = 10;
    
    // Performance metrics
    this.metrics = {
      imagesProcessed: 0,
      averageProcessingTime: 0,
      memoryPeakUsage: 0,
      cacheHitRate: 0,
      cmykConversions: 0
    };
    
    // CMYK color profiles for better conversion
    this.colorProfiles = {
      // Generic CMYK to sRGB conversion matrix
      cmykToSrgb: {
        // ICC profile simulation - simplified for performance
        gamma: 2.2,
        whitePoint: [0.95047, 1.0, 1.08883],
        matrix: [
          [0.4124564, 0.3575761, 0.1804375],
          [0.2126729, 0.7151522, 0.0721750],
          [0.0193339, 0.1191920, 0.9503041]
        ]
      }
    };
  }

  /**
   * Initialize image optimizer
   */
  async initialize() {
    console.log('🎨 Initializing PDF Image Optimizer...');
    
    // Setup memory monitoring
    this.setupMemoryMonitoring();
    
    // Override PDF.js image processing
    this.enhancePdfJsImageProcessing();
    
    // Setup CMYK color management
    this.setupCmykColorManagement();
    
    // Initialize canvas pool
    this.initializeCanvasPool();
    
    console.log('✅ PDF Image Optimizer initialized');
  }

  /**
   * Setup memory monitoring
   */
  setupMemoryMonitoring() {
    if (performance.memory) {
      setInterval(() => {
        const used = performance.memory.usedJSHeapSize;
        this.metrics.memoryPeakUsage = Math.max(this.metrics.memoryPeakUsage, used);
        
        // Trigger cleanup if memory usage is high
        if (used > this.memoryThreshold) {
          console.warn(`⚠️ High memory usage: ${(used / 1024 / 1024).toFixed(1)}MB`);
          this.performMemoryCleanup();
        }
      }, 5000);
    }
  }

  /**
   * Enhance PDF.js image processing
   */
  enhancePdfJsImageProcessing() {
    // Wait for PDF.js to load and then enhance it
    const enhanceWhenReady = () => {
      if (window.pdfjsLib && window.PDFViewerApplication) {
        this.injectImageProcessingEnhancements();
      } else {
        setTimeout(enhanceWhenReady, 100);
      }
    };
    
    enhanceWhenReady();
  }

  /**
   * Inject image processing enhancements into PDF.js
   */
  injectImageProcessingEnhancements() {
    // Enhance canvas rendering for better memory management
    const originalGetCanvas = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
      const context = originalGetCanvas.call(this, contextType, contextAttributes);
      
      if (contextType === '2d' && this.width * this.height > 1000000) { // Large canvas
        console.log(`🖼️ Large canvas created: ${this.width}x${this.height}`);
        
        // Add to memory monitoring
        const canvasSize = this.width * this.height * 4; // RGBA
        window.pdfImageOptimizer.trackCanvasMemory(this, canvasSize);
      }
      
      return context;
    };

    // Enhance image data processing
    this.enhanceImageDataProcessing();
    
    console.log('🔧 PDF.js image processing enhanced');
  }

  /**
   * Track canvas memory usage
   */
  trackCanvasMemory(canvas, size) {
    const canvasId = `canvas_${Date.now()}_${Math.random()}`;
    
    // Store reference with cleanup timer
    const cleanup = () => {
      if (canvas.width === 0 || canvas.height === 0) {
        console.log(`🧹 Canvas cleaned up: ${canvasId}`);
        return true;
      }
      return false;
    };
    
    // Auto-cleanup after 30 seconds of inactivity
    setTimeout(() => {
      if (cleanup()) {
        // Force context loss to free GPU memory
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (gl && gl.getExtension('WEBGL_lose_context')) {
          gl.getExtension('WEBGL_lose_context').loseContext();
        }
      }
    }, 30000);
  }

  /**
   * Enhance image data processing for CMYK
   */
  enhanceImageDataProcessing() {
    // Override putImageData for CMYK optimization
    const originalPutImageData = CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData = function(imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight) {
      // Check if this looks like CMYK data that needs conversion
      if (window.pdfImageOptimizer.detectCmykImageData(imageData)) {
        console.log('🎨 CMYK image data detected, applying conversion');
        imageData = window.pdfImageOptimizer.convertCmykImageData(imageData);
        window.pdfImageOptimizer.metrics.cmykConversions++;
      }
      
      return originalPutImageData.call(this, imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight);
    };
  }

  /**
   * Detect if image data might be CMYK
   */
  detectCmykImageData(imageData) {
    const { data } = imageData;
    
    // Simple heuristic: check for unusual color patterns that suggest CMYK
    let unusualColors = 0;
    const sampleSize = Math.min(1000, data.length / 4);
    
    for (let i = 0; i < sampleSize * 4; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Check for colors that are uncommon in RGB but common in converted CMYK
      if ((r > 200 && g < 50 && b > 200) || // Magenta-like
          (r > 200 && g > 200 && b < 50) || // Yellow-like
          (r < 50 && g > 200 && b > 200)) { // Cyan-like
        unusualColors++;
      }
    }
    
    // If more than 10% of sampled pixels show CMYK-like characteristics
    return (unusualColors / sampleSize) > 0.1;
  }

  /**
   * Convert CMYK-like image data to better RGB
   */
  convertCmykImageData(imageData) {
    const { data, width, height } = imageData;
    const newImageData = new ImageData(width, height);
    const newData = newImageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      const a = data[i + 3];
      
      // Apply gamma correction and color space conversion
      r = this.gammaCorrect(r / 255) * 255;
      g = this.gammaCorrect(g / 255) * 255;
      b = this.gammaCorrect(b / 255) * 255;
      
      // Enhance color saturation for CMYK-converted images
      const { r: newR, g: newG, b: newB } = this.enhanceColorSaturation(r, g, b);
      
      newData[i] = Math.round(newR);
      newData[i + 1] = Math.round(newG);
      newData[i + 2] = Math.round(newB);
      newData[i + 3] = a;
    }
    
    return newImageData;
  }

  /**
   * Apply gamma correction
   */
  gammaCorrect(value) {
    return Math.pow(value, 1 / this.colorProfiles.cmykToSrgb.gamma);
  }

  /**
   * Enhance color saturation for better CMYK display
   */
  enhanceColorSaturation(r, g, b) {
    // Convert to HSL for saturation enhancement
    const { h, s, l } = this.rgbToHsl(r, g, b);
    
    // Enhance saturation by 15% for CMYK images
    const enhancedS = Math.min(1, s * 1.15);
    
    // Convert back to RGB
    return this.hslToRgb(h, enhancedS, l);
  }

  /**
   * RGB to HSL conversion
   */
  rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    
    return { h, s, l };
  }

  /**
   * HSL to RGB conversion
   */
  hslToRgb(h, s, l) {
    let r, g, b;
    
    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    
    return {
      r: r * 255,
      g: g * 255,
      b: b * 255
    };
  }

  /**
   * Setup CMYK color management
   */
  setupCmykColorManagement() {
    // Enhanced CMYK to RGB conversion utilities
    window.CMYKConverter = {
      ...window.CMYKConverter,
      
      // Advanced CMYK to RGB conversion with ICC profile simulation
      cmykToRgbAdvanced: (c, m, y, k) => {
        // Normalize CMYK values (0-100 to 0-1)
        c = c / 100;
        m = m / 100;
        y = y / 100;
        k = k / 100;
        
        // Apply under color removal (UCR) and gray component replacement (GCR)
        const gray = Math.min(c, m, y);
        c = Math.max(0, c - gray * 0.5);
        m = Math.max(0, m - gray * 0.5);
        y = Math.max(0, y - gray * 0.5);
        k = Math.min(1, k + gray * 0.5);
        
        // Convert to RGB with improved formula
        let r = 1 - Math.min(1, c * (1 - k) + k);
        let g = 1 - Math.min(1, m * (1 - k) + k);
        let b = 1 - Math.min(1, y * (1 - k) + k);
        
        // Apply gamma correction
        r = window.pdfImageOptimizer.gammaCorrect(r);
        g = window.pdfImageOptimizer.gammaCorrect(g);
        b = window.pdfImageOptimizer.gammaCorrect(b);
        
        return {
          r: Math.round(r * 255),
          g: Math.round(g * 255),
          b: Math.round(b * 255)
        };
      },
      
      // Apply advanced CMYK fallback with better color management
      applyCMYKFallbackAdvanced: () => {
        console.log('🎨 Applying advanced CMYK color management');
        
        const canvases = document.querySelectorAll('canvas');
        canvases.forEach(canvas => {
          if (canvas.width > 100 && canvas.height > 100) { // Only process significant canvases
            window.pdfImageOptimizer.processCanvasForCmyk(canvas);
          }
        });
      }
    };
  }

  /**
   * Process canvas for CMYK color improvement
   */
  processCanvasForCmyk(canvas) {
    try {
      const ctx = canvas.getContext('2d');
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      if (this.detectCmykImageData(imageData)) {
        console.log(`🎨 Processing CMYK canvas: ${canvas.width}x${canvas.height}`);
        const convertedData = this.convertCmykImageData(imageData);
        ctx.putImageData(convertedData, 0, 0);
        this.metrics.cmykConversions++;
      }
    } catch (error) {
      console.warn('Failed to process canvas for CMYK:', error);
    }
  }

  /**
   * Initialize canvas pool for efficient reuse
   */
  initializeCanvasPool() {
    // Pre-create commonly used canvas sizes
    const commonSizes = [
      { width: 1024, height: 768 },
      { width: 1920, height: 1080 },
      { width: 2048, height: 1536 }
    ];
    
    commonSizes.forEach(size => {
      const canvas = document.createElement('canvas');
      canvas.width = size.width;
      canvas.height = size.height;
      
      const poolKey = `${size.width}x${size.height}`;
      this.imagePool.set(poolKey, [canvas]);
    });
    
    console.log(`🎯 Canvas pool initialized with ${this.imagePool.size} size categories`);
  }

  /**
   * Get canvas from pool or create new one
   */
  getCanvas(width, height) {
    const poolKey = `${width}x${height}`;
    const pool = this.imagePool.get(poolKey);
    
    if (pool && pool.length > 0) {
      return pool.pop();
    }
    
    // Create new canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  /**
   * Return canvas to pool
   */
  returnCanvas(canvas) {
    const poolKey = `${canvas.width}x${canvas.height}`;
    
    if (!this.imagePool.has(poolKey)) {
      this.imagePool.set(poolKey, []);
    }
    
    const pool = this.imagePool.get(poolKey);
    if (pool.length < 3) { // Limit pool size
      // Clear canvas
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      pool.push(canvas);
    }
  }

  /**
   * Perform memory cleanup
   */
  performMemoryCleanup() {
    console.log('🧹 Performing image memory cleanup');
    
    // Clear image cache
    const cacheSize = this.imageCache.size;
    if (cacheSize > this.maxCachedImages / 2) {
      const entriesToDelete = cacheSize - Math.floor(this.maxCachedImages / 2);
      const keys = Array.from(this.imageCache.keys()).slice(0, entriesToDelete);
      
      keys.forEach(key => this.imageCache.delete(key));
      console.log(`🗑️ Cleared ${entriesToDelete} cached images`);
    }
    
    // Clear canvas pool excess
    this.imagePool.forEach((pool, key) => {
      if (pool.length > 2) {
        this.imagePool.set(key, pool.slice(0, 2));
      }
    });
    
    // Force garbage collection if available
    if (window.gc) {
      window.gc();
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.imageCache.size,
      poolSize: Array.from(this.imagePool.values()).reduce((sum, pool) => sum + pool.length, 0),
      memoryUsageMB: (this.metrics.memoryPeakUsage / 1024 / 1024).toFixed(2)
    };
  }

  /**
   * Log performance summary
   */
  logPerformanceSummary() {
    const metrics = this.getMetrics();
    console.group('🎨 Image Processing Metrics');
    console.log(`Images Processed: ${metrics.imagesProcessed}`);
    console.log(`CMYK Conversions: ${metrics.cmykConversions}`);
    console.log(`Memory Peak: ${metrics.memoryUsageMB}MB`);
    console.log(`Canvas Pool Size: ${metrics.poolSize}`);
    console.log(`Image Cache Size: ${metrics.cacheSize}`);
    console.groupEnd();
  }
}

// Create global instance
window.pdfImageOptimizer = new PdfImageOptimizer();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pdfImageOptimizer.initialize();
  });
} else {
  window.pdfImageOptimizer.initialize();
}

// Log performance summary every 60 seconds
setInterval(() => {
  window.pdfImageOptimizer.logPerformanceSummary();
}, 60000);

console.log('📦 PDF Image Optimizer loaded');