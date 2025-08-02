/**
 * PDF Cache Manager
 * Client-side interface for managing PDF.js caching and performance
 */

class PdfCacheManager {
  constructor() {
    this.serviceWorkerRegistration = null;
    this.isSupported = 'serviceWorker' in navigator;
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      networkRequests: 0,
      totalSavedBytes: 0
    };
  }

  /**
   * Initialize cache manager and service worker
   */
  async initialize() {
    if (!this.isSupported) {
      console.warn('⚠️ Service Worker not supported - advanced caching disabled');
      return false;
    }

    try {
      console.log('🔧 Initializing PDF Cache Manager...');
      
      // Register service worker
      this.serviceWorkerRegistration = await navigator.serviceWorker.register(
        '/pdf-cache-worker.js',
        { scope: '/' }
      );

      // Handle service worker updates
      this.serviceWorkerRegistration.addEventListener('updatefound', () => {
        console.log('🔄 PDF Cache Worker update found');
        const newWorker = this.serviceWorkerRegistration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('✅ PDF Cache Worker updated - reload recommended');
            this.notifyUpdate();
          }
        });
      });

      // Monitor cache performance
      this.setupPerformanceMonitoring();
      
      console.log('✅ PDF Cache Manager initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize PDF Cache Manager:', error);
      return false;
    }
  }

  /**
   * Setup performance monitoring
   */
  setupPerformanceMonitoring() {
    // Monitor fetch events for cache metrics
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      
      try {
        const response = await originalFetch.apply(window, args);
        const loadTime = performance.now() - startTime;
        
        // Estimate if response came from cache (very fast response)
        if (loadTime < 10 && response.ok) {
          this.metrics.cacheHits++;
          console.log(`⚡ Fast response (likely cached): ${url} (${loadTime.toFixed(2)}ms)`);
        } else {
          this.metrics.networkRequests++;
        }
        
        return response;
      } catch (error) {
        this.metrics.cacheMisses++;
        throw error;
      }
    };
  }

  /**
   * Get cache status from service worker
   */
  async getCacheStatus() {
    if (!this.serviceWorkerRegistration) {
      return { error: 'Service worker not registered' };
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_STATUS') {
          resolve(event.data.data);
        }
      };
      
      this.serviceWorkerRegistration.active.postMessage(
        { type: 'GET_CACHE_STATUS' },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Clear specific cache type
   */
  async clearCache(cacheType = 'all') {
    if (!this.serviceWorkerRegistration) {
      return false;
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'CACHE_CLEARED') {
          console.log(`🧹 Cache cleared: ${cacheType}`);
          resolve(true);
        }
      };
      
      this.serviceWorkerRegistration.active.postMessage(
        { type: 'CLEAR_CACHE', data: { cacheType } },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Preload critical resources
   */
  async preloadCriticalResources() {
    const criticalResources = [
      '/pdfjs-full/wasm/openjpeg.wasm',
      '/pdfjs-full/wasm/qcms_bg.wasm',
      '/pdfjs-full/build/pdf.worker.mjs',
      '/pdf-night-mode.css'
    ];

    if (!this.serviceWorkerRegistration) {
      // Fallback: preload without service worker
      return Promise.all(
        criticalResources.map(url => 
          fetch(url).catch(err => console.warn(`Preload failed: ${url}`, err))
        )
      );
    }

    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.type === 'RESOURCES_PRELOADED') {
          console.log('🎯 Critical resources preloaded');
          resolve(true);
        }
      };
      
      this.serviceWorkerRegistration.active.postMessage(
        { type: 'PRELOAD_RESOURCES', data: { urls: criticalResources } },
        [messageChannel.port2]
      );
    });
  }

  /**
   * Estimate cache storage usage
   */
  async estimateStorageUsage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        return {
          used: estimate.usage,
          quota: estimate.quota,
          usedMB: (estimate.usage / 1024 / 1024).toFixed(2),
          quotaMB: (estimate.quota / 1024 / 1024).toFixed(2),
          percentage: ((estimate.usage / estimate.quota) * 100).toFixed(1)
        };
      } catch (error) {
        console.warn('Storage estimation failed:', error);
      }
    }
    return null;
  }

  /**
   * Optimize for mobile devices
   */
  async optimizeForMobile() {
    const isMobile = window.innerWidth <= 768 || 
                     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile) return;

    console.log('📱 Applying mobile optimizations');

    // Reduce cache sizes for mobile
    await this.clearCache('dynamic');
    
    // Preload only essential resources
    const mobileResources = [
      '/pdfjs-full/wasm/openjpeg.wasm', // Essential for JPEG2000
      '/pdf-night-mode.css' // Small CSS file
    ];

    return this.preloadResources(mobileResources);
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const totalRequests = this.metrics.cacheHits + this.metrics.networkRequests + this.metrics.cacheMisses;
    const cacheHitRate = totalRequests > 0 ? (this.metrics.cacheHits / totalRequests * 100).toFixed(1) : 0;

    return {
      ...this.metrics,
      cacheHitRate: `${cacheHitRate}%`,
      totalRequests,
      isServiceWorkerActive: !!this.serviceWorkerRegistration?.active
    };
  }

  /**
   * Monitor PDF loading performance
   */
  monitorPdfLoading(pdfUrl) {
    const startTime = performance.now();
    console.log(`📄 Starting PDF load: ${pdfUrl}`);

    return {
      onProgress: (loaded, total) => {
        const percentage = ((loaded / total) * 100).toFixed(1);
        console.log(`📊 PDF loading: ${percentage}% (${(loaded / 1024 / 1024).toFixed(2)}MB / ${(total / 1024 / 1024).toFixed(2)}MB)`);
      },
      
      onComplete: () => {
        const loadTime = performance.now() - startTime;
        console.log(`✅ PDF loaded in ${loadTime.toFixed(2)}ms`);
        
        // Log cache efficiency
        const metrics = this.getMetrics();
        console.log(`📈 Cache hit rate: ${metrics.cacheHitRate}`);
      },
      
      onError: (error) => {
        const loadTime = performance.now() - startTime;
        console.error(`❌ PDF load failed after ${loadTime.toFixed(2)}ms:`, error);
      }
    };
  }

  /**
   * Notify about service worker updates
   */
  notifyUpdate() {
    // You can integrate this with your app's notification system
    console.log('🔄 PDF Cache has been updated. Consider reloading for better performance.');
    
    // Optionally show a user notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('PDF Reader Updated', {
        body: 'Enhanced caching is now available. Reload for better performance.',
        icon: '/images/icon-192.png'
      });
    }
  }

  /**
   * Force cache update for critical resources
   */
  async updateCriticalResources() {
    console.log('🔄 Updating critical resources...');
    
    // Clear existing WASM cache to force refresh
    await this.clearCache('wasm');
    
    // Preload fresh resources
    await this.preloadCriticalResources();
    
    console.log('✅ Critical resources updated');
  }

  /**
   * Debug cache information
   */
  async debugCacheInfo() {
    const status = await this.getCacheStatus();
    const storage = await this.estimateStorageUsage();
    const metrics = this.getMetrics();

    console.group('🔍 PDF Cache Debug Info');
    console.log('Cache Status:', status);
    console.log('Storage Usage:', storage);
    console.log('Performance Metrics:', metrics);
    console.log('Service Worker:', this.serviceWorkerRegistration?.active?.state);
    console.groupEnd();

    return { status, storage, metrics };
  }
}

// Create global instance
window.pdfCacheManager = new PdfCacheManager();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.pdfCacheManager.initialize();
  });
} else {
  window.pdfCacheManager.initialize();
}

console.log('📦 PDF Cache Manager loaded');