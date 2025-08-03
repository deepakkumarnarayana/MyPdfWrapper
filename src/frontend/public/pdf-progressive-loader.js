/**
 * PDF Progressive Loader
 * Advanced progressive loading strategies for large PDFs
 * Optimizes initial load time and implements smart preloading
 */

class PdfProgressiveLoader {
  constructor() {
    this.loadingStrategy = 'adaptive'; // 'adaptive', 'aggressive', 'conservative'
    this.preloadDistance = 2; // Number of pages to preload ahead/behind
    this.currentPage = 1;
    this.totalPages = 0;
    this.loadedPages = new Set();
    this.loadingPages = new Set();
    this.preloadQueue = [];
    
    // Performance metrics
    this.metrics = {
      initialLoadTime: 0,
      pageLoadTimes: new Map(),
      cacheHits: 0,
      preloadHits: 0,
      networkSaved: 0
    };
    
    // Connection monitoring
    this.connectionInfo = {
      effectiveType: '4g',
      downlink: 10,
      rtt: 100
    };
    
    this.updateConnectionInfo();
  }

  /**
   * Initialize progressive loader
   */
  async initialize() {
    console.log('⚡ Initializing PDF Progressive Loader');
    
    // Setup connection monitoring
    this.setupConnectionMonitoring();
    
    // Setup intersection observer for page visibility
    this.setupPageVisibilityObserver();
    
    // Enhance PDF.js with progressive loading
    this.enhancePdfJsLoading();
    
    // Setup idle time preloading
    this.setupIdlePreloading();
    
    console.log('✅ Progressive loader initialized');
  }

  /**
   * Setup connection monitoring for adaptive loading
   */
  setupConnectionMonitoring() {
    if ('connection' in navigator) {
      const connection = navigator.connection;
      
      const updateStrategy = () => {
        this.updateConnectionInfo();
        this.adaptLoadingStrategy();
      };
      
      connection.addEventListener('change', updateStrategy);
      updateStrategy();
    }
  }

  /**
   * Update connection information
   */
  updateConnectionInfo() {
    if ('connection' in navigator) {
      const conn = navigator.connection;
      this.connectionInfo = {
        effectiveType: conn.effectiveType || '4g',
        downlink: conn.downlink || 10,
        rtt: conn.rtt || 100
      };
    }
  }

  /**
   * Adapt loading strategy based on connection
   */
  adaptLoadingStrategy() {
    const { effectiveType, downlink } = this.connectionInfo;
    
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      this.loadingStrategy = 'conservative';
      this.preloadDistance = 1;
      console.log('📱 Slow connection detected - using conservative loading');
    } else if (effectiveType === '3g' || downlink < 2) {
      this.loadingStrategy = 'adaptive';
      this.preloadDistance = 2;
      console.log('📶 Moderate connection - using adaptive loading');
    } else {
      this.loadingStrategy = 'aggressive';
      this.preloadDistance = 3;
      console.log('🚀 Fast connection - using aggressive loading');
    }
  }

  /**
   * Setup page visibility observer
   */
  setupPageVisibilityObserver() {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported');
      return;
    }

    // Observe page elements for preloading
    this.pageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const pageNum = parseInt(entry.target.dataset.pageNumber);
          
          if (entry.isIntersecting) {
            console.log(`👁️ Page ${pageNum} visible`);
            this.onPageVisible(pageNum);
          }
        });
      },
      {
        // Start preloading when page is 50% visible
        threshold: 0.5,
        // Extend root margin for early preloading
        rootMargin: '100px 0px 100px 0px'
      }
    );
  }

  /**
   * Page becomes visible - trigger preloading
   */
  onPageVisible(pageNum) {
    this.currentPage = pageNum;
    
    // Preload adjacent pages based on strategy
    this.schedulePreloading(pageNum);
    
    // Update metrics
    if (this.loadedPages.has(pageNum)) {
      this.metrics.preloadHits++;
      console.log(`⚡ Preload hit for page ${pageNum}`);
    }
  }

  /**
   * Schedule intelligent preloading
   */
  schedulePreloading(currentPage) {
    const pagesToPreload = this.calculatePreloadPages(currentPage);
    
    pagesToPreload.forEach(pageNum => {
      if (!this.loadedPages.has(pageNum) && 
          !this.loadingPages.has(pageNum) && 
          !this.preloadQueue.includes(pageNum)) {
        this.preloadQueue.push(pageNum);
      }
    });
    
    // Process preload queue
    this.processPreloadQueue();
  }

  /**
   * Calculate which pages to preload
   */
  calculatePreloadPages(currentPage) {
    const pages = [];
    
    // Add pages ahead (higher priority)
    for (let i = 1; i <= this.preloadDistance; i++) {
      const nextPage = currentPage + i;
      if (nextPage <= this.totalPages) {
        pages.push(nextPage);
      }
    }
    
    // Add pages behind (lower priority)
    for (let i = 1; i <= Math.floor(this.preloadDistance / 2); i++) {
      const prevPage = currentPage - i;
      if (prevPage >= 1) {
        pages.push(prevPage);
      }
    }
    
    // Sort by priority (closest pages first)
    return pages.sort((a, b) => Math.abs(a - currentPage) - Math.abs(b - currentPage));
  }

  /**
   * Process preload queue with rate limiting
   */
  async processPreloadQueue() {
    if (this.preloadQueue.length === 0) return;
    
    // Rate limit based on connection
    const maxConcurrent = this.getMaxConcurrentLoads();
    const currentLoading = this.loadingPages.size;
    
    if (currentLoading >= maxConcurrent) {
      console.log(`⏳ Preload queue waiting (${currentLoading}/${maxConcurrent} loading)`);
      return;
    }
    
    const pageToLoad = this.preloadQueue.shift();
    await this.preloadPage(pageToLoad);
    
    // Continue processing queue
    setTimeout(() => this.processPreloadQueue(), 100);
  }

  /**
   * Get maximum concurrent loads based on connection
   */
  getMaxConcurrentLoads() {
    switch (this.loadingStrategy) {
      case 'aggressive': return 3;
      case 'adaptive': return 2;
      case 'conservative': return 1;
      default: return 2;
    }
  }

  /**
   * Preload a specific page
   */
  async preloadPage(pageNum) {
    if (this.loadedPages.has(pageNum) || this.loadingPages.has(pageNum)) {
      return;
    }
    
    this.loadingPages.add(pageNum);
    console.log(`📄 Preloading page ${pageNum}...`);
    
    const startTime = performance.now();
    
    try {
      // Use PDF.js API to render page off-screen
      await this.renderPageOffscreen(pageNum);
      
      const loadTime = performance.now() - startTime;
      this.metrics.pageLoadTimes.set(pageNum, loadTime);
      this.loadedPages.add(pageNum);
      
      console.log(`✅ Page ${pageNum} preloaded in ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      console.error(`❌ Failed to preload page ${pageNum}:`, error);
    } finally {
      this.loadingPages.delete(pageNum);
    }
  }

  /**
   * Render page off-screen for preloading
   */
  async renderPageOffscreen(pageNum) {
    if (!window.PDFViewerApplication || !window.PDFViewerApplication.pdfDocument) {
      throw new Error('PDF document not available');
    }
    
    const pdfDocument = window.PDFViewerApplication.pdfDocument;
    const page = await pdfDocument.getPage(pageNum);
    
    // Calculate optimal viewport
    const viewport = page.getViewport({ scale: 1.0 });
    
    // Create off-screen canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    const context = canvas.getContext('2d');
    
    // Render page
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
      // Optimize for preloading
      intent: 'display',
      enableWebGL: false, // Disable WebGL for off-screen rendering
    };
    
    await page.render(renderContext).promise;
    
    // Store rendered data for later use (optional)
    this.storePreloadedPage(pageNum, canvas);
  }

  /**
   * Store preloaded page data
   */
  storePreloadedPage(pageNum, canvas) {
    // Convert to compressed blob for storage
    canvas.toBlob((blob) => {
      if (blob && 'caches' in window) {
        // Store in cache for instant retrieval
        caches.open('pdf-preload-cache').then(cache => {
          const response = new Response(blob);
          cache.put(`/preload/page-${pageNum}`, response);
        });
      }
    }, 'image/webp', 0.8); // Use WebP for better compression
  }

  /**
   * Setup idle time preloading
   */
  setupIdlePreloading() {
    if ('requestIdleCallback' in window) {
      const idlePreload = (deadline) => {
        while (deadline.timeRemaining() > 0 && this.preloadQueue.length > 0) {
          const pageNum = this.preloadQueue.shift();
          if (!this.loadedPages.has(pageNum)) {
            this.preloadPage(pageNum);
            break; // Only one page per idle callback
          }
        }
        
        // Schedule next idle callback
        requestIdleCallback(idlePreload);
      };
      
      requestIdleCallback(idlePreload);
    }
  }

  /**
   * Enhance PDF.js with progressive loading
   */
  enhancePdfJsLoading() {
    // Wait for PDF.js to be available
    const enhance = () => {
      if (window.PDFViewerApplication && window.PDFViewerApplication.eventBus) {
        this.setupPdfJsEventListeners();
      } else {
        setTimeout(enhance, 100);
      }
    };
    
    enhance();
  }

  /**
   * Setup PDF.js event listeners
   */
  setupPdfJsEventListeners() {
    const eventBus = window.PDFViewerApplication.eventBus;
    
    // Listen for document loaded
    eventBus.on('documentloaded', (evt) => {
      this.totalPages = evt.source.pagesCount;
      console.log(`📚 PDF loaded: ${this.totalPages} pages`);
      
      // Start initial preloading
      this.schedulePreloading(1);
    });
    
    // Listen for page changes
    eventBus.on('pagechanging', (evt) => {
      const newPage = evt.pageNumber;
      console.log(`📄 Page changed to ${newPage}`);
      
      this.currentPage = newPage;
      this.schedulePreloading(newPage);
    });
    
    // Listen for pages loaded
    eventBus.on('pagesloaded', () => {
      console.log('📋 PDF pages structure loaded');
      this.observePageElements();
    });
  }

  /**
   * Observe page elements for intersection
   */
  observePageElements() {
    if (!this.pageObserver) return;
    
    // Find and observe page elements
    const pageElements = document.querySelectorAll('.page[data-page-number]');
    pageElements.forEach(element => {
      this.pageObserver.observe(element);
    });
    
    console.log(`👁️ Observing ${pageElements.length} page elements`);
  }

  /**
   * Optimize loading based on user behavior
   */
  optimizeForUserBehavior() {
    // Track scroll speed to predict page changes
    let lastScrollTop = window.pageYOffset;
    let scrollSpeed = 0;
    
    const trackScroll = () => {
      const currentScrollTop = window.pageYOffset;
      scrollSpeed = Math.abs(currentScrollTop - lastScrollTop);
      lastScrollTop = currentScrollTop;
      
      // Adjust preload distance based on scroll speed
      if (scrollSpeed > 100) {
        // Fast scrolling - increase preload distance
        this.preloadDistance = Math.min(5, this.preloadDistance + 1);
      } else if (scrollSpeed < 10) {
        // Slow/no scrolling - reduce preload distance
        this.preloadDistance = Math.max(1, this.preloadDistance - 1);
      }
    };
    
    setInterval(trackScroll, 500);
  }

  /**
   * Force preload critical pages
   */
  async preloadCriticalPages(pageNumbers) {
    console.log(`🎯 Force preloading critical pages: ${pageNumbers.join(', ')}`);
    
    const promises = pageNumbers.map(pageNum => {
      if (!this.loadedPages.has(pageNum)) {
        return this.preloadPage(pageNum);
      }
    });
    
    await Promise.all(promises);
    console.log('✅ Critical pages preloaded');
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const totalPages = this.metrics.pageLoadTimes.size;
    const averageLoadTime = totalPages > 0 
      ? Array.from(this.metrics.pageLoadTimes.values()).reduce((sum, time) => sum + time, 0) / totalPages
      : 0;
      
    return {
      ...this.metrics,
      totalPagesLoaded: totalPages,
      averageLoadTime: averageLoadTime.toFixed(2),
      preloadHitRate: this.metrics.preloadHits / Math.max(1, this.metrics.preloadHits + this.metrics.pageLoadTimes.size) * 100,
      currentStrategy: this.loadingStrategy,
      preloadDistance: this.preloadDistance,
      queueSize: this.preloadQueue.length,
      loadingPages: this.loadingPages.size
    };
  }

  /**
   * Clear preload cache
   */
  async clearPreloadCache() {
    if ('caches' in window) {
      await caches.delete('pdf-preload-cache');
      console.log('🧹 Preload cache cleared');
    }
  }

  /**
   * Log performance summary
   */
  logPerformanceSummary() {
    const metrics = this.getMetrics();
    console.group('⚡ Progressive Loading Metrics');
    console.log(`Strategy: ${metrics.currentStrategy}`);
    console.log(`Pages Loaded: ${metrics.totalPagesLoaded}/${this.totalPages}`);
    console.log(`Average Load Time: ${metrics.averageLoadTime}ms`);
    console.log(`Preload Hit Rate: ${metrics.preloadHitRate.toFixed(1)}%`);
    console.log(`Queue Size: ${metrics.queueSize}`);
    console.log(`Currently Loading: ${metrics.loadingPages}`);
    console.groupEnd();
  }
}

// Create global instance
window.pdfProgressiveLoader = new PdfProgressiveLoader();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pdfProgressiveLoader.initialize();
  });
} else {
  window.pdfProgressiveLoader.initialize();
}

// Log performance summary every 60 seconds
setInterval(() => {
  window.pdfProgressiveLoader.logPerformanceSummary();
}, 60000);

console.log('📦 PDF Progressive Loader loaded');