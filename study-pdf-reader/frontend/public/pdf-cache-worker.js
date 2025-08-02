/**
 * PDF Cache Service Worker
 * Advanced caching strategy for PDF.js resources and large PDF files
 * Optimized for WASM modules, fonts, and progressive PDF loading
 */

const CACHE_VERSION = 'pdf-cache-v2.0.0';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const PDF_CACHE = `${CACHE_VERSION}-pdfs`;
const WASM_CACHE = `${CACHE_VERSION}-wasm`;

// Cache strategies by resource type
const CACHE_STRATEGIES = {
  // WASM files - Cache first with long TTL
  wasm: {
    strategy: 'cache-first',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    maxEntries: 10
  },
  
  // PDF files - Network first with fallback
  pdf: {
    strategy: 'network-first',
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    maxEntries: 20
  },
  
  // Static assets - Cache first
  static: {
    strategy: 'cache-first',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    maxEntries: 100
  },
  
  // Dynamic content - Network first
  dynamic: {
    strategy: 'network-first',
    maxAge: 5 * 60 * 1000, // 5 minutes
    maxEntries: 50
  }
};

// Static resources to cache immediately
const STATIC_RESOURCES = [
  '/pdfjs-full/viewer.html',
  '/pdfjs-full/viewer.css',
  '/pdfjs-full/viewer.mjs',
  '/pdfjs-full/build/pdf.mjs',
  '/pdfjs-full/build/pdf.worker.mjs',
  '/pdfjs-performance-optimizer.js',
  '/pdf-night-mode.css'
];

// WASM resources for aggressive caching
const WASM_RESOURCES = [
  '/pdfjs-full/wasm/openjpeg.wasm',
  '/pdfjs-full/wasm/qcms_bg.wasm',
  '/pdfjs-full/wasm/openjpeg_nowasm_fallback.js'
];

/**
 * Install event - Cache static resources
 */
self.addEventListener('install', event => {
  console.log('📦 PDF Cache Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static resources
      caches.open(STATIC_CACHE).then(cache => {
        console.log('📂 Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      }),
      
      // Cache WASM resources
      caches.open(WASM_CACHE).then(cache => {
        console.log('⚡ Caching WASM resources');
        return cache.addAll(WASM_RESOURCES);
      })
    ]).then(() => {
      console.log('✅ PDF Cache Worker installed successfully');
      self.skipWaiting();
    })
  );
});

/**
 * Activate event - Clean up old caches
 */
self.addEventListener('activate', event => {
  console.log('🔄 PDF Cache Worker activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName.includes('pdf-cache-') && !cacheName.includes(CACHE_VERSION)) {
            console.log(`🗑️ Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ PDF Cache Worker activated');
      self.clients.claim();
    })
  );
});

/**
 * Fetch event - Implement caching strategies
 */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // Determine resource type and strategy
  const resourceType = getResourceType(url.pathname);
  const strategy = CACHE_STRATEGIES[resourceType];
  
  if (!strategy) {
    return; // Let browser handle
  }
  
  event.respondWith(
    handleRequest(request, resourceType, strategy)
  );
});

/**
 * Determine resource type from URL
 */
function getResourceType(pathname) {
  if (pathname.includes('.wasm') || pathname.includes('wasm/')) {
    return 'wasm';
  }
  
  if (pathname.includes('.pdf') || pathname.includes('pdf-url')) {
    return 'pdf';
  }
  
  if (pathname.includes('/pdfjs-full/') || 
      pathname.includes('.css') || 
      pathname.includes('.mjs') ||
      pathname.includes('.js') ||
      pathname.includes('/images/') ||
      pathname.includes('/cmaps/') ||
      pathname.includes('/locale/')) {
    return 'static';
  }
  
  return 'dynamic';
}

/**
 * Handle request with appropriate caching strategy
 */
async function handleRequest(request, resourceType, strategy) {
  const cacheName = getCacheName(resourceType);
  
  try {
    switch (strategy.strategy) {
      case 'cache-first':
        return await cacheFirst(request, cacheName, strategy);
      
      case 'network-first':
        return await networkFirst(request, cacheName, strategy);
      
      default:
        return fetch(request);
    }
  } catch (error) {
    console.error(`❌ Cache strategy failed for ${request.url}:`, error);
    return fetch(request);
  }
}

/**
 * Cache-first strategy with fallback
 */
async function cacheFirst(request, cacheName, strategy) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  
  if (cached) {
    console.log(`⚡ Cache hit: ${request.url}`);
    
    // Check if resource is stale and update in background
    if (await isStale(cached, strategy.maxAge)) {
      console.log(`🔄 Background refresh: ${request.url}`);
      updateCacheInBackground(request, cache);
    }
    
    return cached;
  }
  
  console.log(`📥 Cache miss: ${request.url}`);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      await cleanupCache(cache, strategy.maxEntries);
    }
    return response;
  } catch (error) {
    console.error(`❌ Network failed: ${request.url}`, error);
    throw error;
  }
}

/**
 * Network-first strategy with cache fallback
 */
async function networkFirst(request, cacheName, strategy) {
  const cache = await caches.open(cacheName);
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      console.log(`📡 Network success: ${request.url}`);
      await cache.put(request, response.clone());
      await cleanupCache(cache, strategy.maxEntries);
    }
    
    return response;
  } catch (error) {
    console.log(`📱 Network failed, trying cache: ${request.url}`);
    
    const cached = await cache.match(request);
    if (cached) {
      console.log(`⚡ Cache fallback: ${request.url}`);
      return cached;
    }
    
    throw error;
  }
}

/**
 * Update cache in background
 */
async function updateCacheInBackground(request, cache) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response);
      console.log(`✅ Background update: ${request.url}`);
    }
  } catch (error) {
    console.error(`❌ Background update failed: ${request.url}`, error);
  }
}

/**
 * Check if cached resource is stale
 */
async function isStale(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;
  
  const responseDate = new Date(dateHeader);
  const now = new Date();
  
  return (now - responseDate) > maxAge;
}

/**
 * Clean up cache entries to maintain size limits
 */
async function cleanupCache(cache, maxEntries) {
  const keys = await cache.keys();
  
  if (keys.length > maxEntries) {
    const deleteCount = keys.length - maxEntries;
    const keysToDelete = keys.slice(0, deleteCount);
    
    await Promise.all(
      keysToDelete.map(key => cache.delete(key))
    );
    
    console.log(`🧹 Cleaned ${deleteCount} cache entries`);
  }
}

/**
 * Get cache name for resource type
 */
function getCacheName(resourceType) {
  switch (resourceType) {
    case 'wasm':
      return WASM_CACHE;
    case 'pdf':
      return PDF_CACHE;
    case 'static':
      return STATIC_CACHE;
    default:
      return DYNAMIC_CACHE;
  }
}

/**
 * Handle cache status messages from main thread
 */
self.addEventListener('message', event => {
  const { type, data } = event.data;
  
  switch (type) {
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage({ type: 'CACHE_STATUS', data: status });
      });
      break;
      
    case 'CLEAR_CACHE':
      clearSpecificCache(data.cacheType).then(() => {
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;
      
    case 'PRELOAD_RESOURCES':
      preloadResources(data.urls).then(() => {
        event.ports[0].postMessage({ type: 'RESOURCES_PRELOADED' });
      });
      break;
  }
});

/**
 * Get cache status information
 */
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  
  for (const cacheName of cacheNames) {
    if (cacheName.includes(CACHE_VERSION)) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = {
        size: keys.length,
        urls: keys.map(key => key.url).slice(0, 5) // First 5 URLs for debug
      };
    }
  }
  
  return status;
}

/**
 * Clear specific cache
 */
async function clearSpecificCache(cacheType) {
  const cacheName = getCacheName(cacheType);
  return caches.delete(cacheName);
}

/**
 * Preload specific resources
 */
async function preloadResources(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  const preloadPromises = urls.map(async url => {
    try {
      const response = await fetch(url);
      if (response.ok) {
        await cache.put(url, response);
        console.log(`🎯 Preloaded: ${url}`);
      }
    } catch (error) {
      console.error(`❌ Preload failed: ${url}`, error);
    }
  });
  
  return Promise.all(preloadPromises);
}

console.log('🚀 PDF Cache Service Worker ready');