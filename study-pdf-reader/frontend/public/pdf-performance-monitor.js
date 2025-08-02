// PDF.js Performance Monitor
// Tracks performance metrics and manages memory for large PDFs

(function() {
  'use strict';

  // Performance tracking
  window.PDFPerformanceMonitor = {
    metrics: {
      wasmLoadTime: 0,
      firstPageRender: 0,
      imageDecodeTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0
    },
    
    timers: new Map(),
    cacheStats: { hits: 0, misses: 0 },

    startTiming(operation) {
      this.timers.set(operation, performance.now());
      performance.mark(`${operation}-start`);
    },

    endTiming(operation) {
      const startTime = this.timers.get(operation);
      if (startTime) {
        const duration = performance.now() - startTime;
        this.metrics[operation] = duration;
        performance.mark(`${operation}-end`);
        performance.measure(operation, `${operation}-start`, `${operation}-end`);
        
        // Log significant operations
        if (duration > 100) {
          console.log(`⏱️ ${operation}: ${duration.toFixed(2)}ms`);
        }
        
        this.timers.delete(operation);
        return duration;
      }
    },

    recordCacheHit() {
      this.cacheStats.hits++;
      this.updateCacheHitRate();
    },

    recordCacheMiss() {
      this.cacheStats.misses++;
      this.updateCacheHitRate();
    },

    updateCacheHitRate() {
      const total = this.cacheStats.hits + this.cacheStats.misses;
      this.metrics.cacheHitRate = total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
    },

    getMemoryUsage() {
      if (performance.memory) {
        this.metrics.memoryUsage = {
          used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024), // MB
          total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };
      }
      return this.metrics.memoryUsage;
    },

    generateReport() {
      this.getMemoryUsage();
      
      const report = {
        timestamp: new Date().toISOString(),
        performance: this.metrics,
        browserInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          hardwareConcurrency: navigator.hardwareConcurrency,
          connection: navigator.connection ? {
            effectiveType: navigator.connection.effectiveType,
            downlink: navigator.connection.downlink
          } : null
        }
      };

      console.table(this.metrics);
      return report;
    },

    // Memory cleanup for large PDFs
    cleanupUnusedResources() {
      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }
      
      // Clear performance entries older than 5 minutes
      const fiveMinutesAgo = performance.now() - (5 * 60 * 1000);
      performance.getEntries()
        .filter(entry => entry.startTime < fiveMinutesAgo)
        .forEach(entry => performance.clearMarks(entry.name));
      
      console.log('🧹 Cleaned up unused PDF resources');
    }
  };

  // Memory management for large images
  window.PDFMemoryManager = {
    maxMemoryUsage: 500, // MB
    imageCache: new Map(),
    maxCacheSize: 50, // Max cached images

    monitorMemory() {
      const usage = window.PDFPerformanceMonitor.getMemoryUsage();
      
      if (usage.used > this.maxMemoryUsage) {
        console.warn(`⚠️ High memory usage: ${usage.used}MB`);
        this.freeMemory();
      }
    },

    freeMemory() {
      // Clear oldest cached images
      const cacheEntries = Array.from(this.imageCache.entries());
      const toRemove = Math.ceil(cacheEntries.length * 0.3); // Remove 30%
      
      cacheEntries
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
        .slice(0, toRemove)
        .forEach(([key]) => {
          this.imageCache.delete(key);
        });

      // Request garbage collection
      window.PDFPerformanceMonitor.cleanupUnusedResources();
      
      console.log(`🗑️ Freed memory, removed ${toRemove} cached images`);
    },

    cacheImage(key, imageData) {
      if (this.imageCache.size >= this.maxCacheSize) {
        this.freeMemory();
      }
      
      this.imageCache.set(key, {
        data: imageData,
        lastAccessed: Date.now(),
        size: imageData.byteLength || 0
      });
    },

    getCachedImage(key) {
      const cached = this.imageCache.get(key);
      if (cached) {
        cached.lastAccessed = Date.now();
        return cached.data;
      }
      return null;
    }
  };

  // Auto-monitor memory every 30 seconds
  setInterval(() => {
    window.PDFMemoryManager.monitorMemory();
  }, 30000);

  // Performance monitoring hooks
  if (window.pdfjsLib) {
    console.log('📊 PDF.js performance monitoring enabled');
  } else {
    // Wait for PDF.js to load
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        if (window.pdfjsLib) {
          console.log('📊 PDF.js performance monitoring enabled');
        }
      }, 1000);
    });
  }

  console.log('🚀 PDF Performance Monitor initialized');
})();