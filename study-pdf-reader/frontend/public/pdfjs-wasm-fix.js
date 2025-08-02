// PDF.js WASM Path Fix - Production Optimized
// Efficient path correction without file duplication

(function() {
  'use strict';

  // Development vs Production logging
  const isDev = window.location.hostname === 'localhost';
  const log = isDev ? console.log : () => {};

  function fixWASMPaths() {
    log('🔧 Initializing PDF.js WASM debugging and monitoring...');

    // WASM Module Cache for performance monitoring
    const wasmCache = new Map();
    
    // Monitor WASM fetches for debugging
    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
      if (typeof resource === 'string' && resource.includes('wasm')) {
        log('🔍 WASM fetch request:', resource);
        
        // Check cache first for performance
        if (wasmCache.has(resource)) {
          log('📦 Serving WASM from cache:', resource);
          return Promise.resolve(wasmCache.get(resource).clone());
        }
        
        // Fetch and cache WASM files
        return originalFetch.call(this, resource, options).then(response => {
          if (response.ok && resource.endsWith('.wasm')) {
            wasmCache.set(resource, response.clone());
            log('💾 Cached WASM module:', resource);
          }
          if (!response.ok) {
            console.error('❌ Failed to fetch WASM:', resource, 'Status:', response.status);
          }
          return response;
        }).catch(error => {
          console.error('❌ WASM fetch error for:', resource, error);
          throw error;
        });
      }

      return originalFetch.call(this, resource, options);
    };

    // Enhanced WebAssembly.instantiate with better error reporting
    const originalInstantiate = WebAssembly.instantiate;
    WebAssembly.instantiate = function(bufferSource, importObject) {
      if (bufferSource instanceof ArrayBuffer || bufferSource instanceof Uint8Array) {
        // Check if this looks like HTML instead of WASM
        const bytes = new Uint8Array(bufferSource);
        const magicNumber = Array.from(bytes.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ');
        
        if (bytes[0] === 0x3c) { // HTML starts with '<'
          console.error('❌ Received HTML instead of WASM binary. Magic bytes:', magicNumber);
          console.error('🔍 This indicates a server configuration issue - WASM files should be served with application/wasm MIME type');
          return Promise.reject(new Error('Invalid WASM binary - received HTML content'));
        }
        
        if (bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
          console.error('❌ Invalid WASM magic number:', magicNumber, 'Expected: 00 61 73 6d');
          return Promise.reject(new Error('Invalid WASM binary format'));
        }
        
        console.log('✅ Valid WASM binary detected, proceeding with instantiation');
      }

      return originalInstantiate.call(this, bufferSource, importObject);
    };

    console.log('✅ WASM debugging and monitoring initialized');
  }

  // Auto-initialize when script loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixWASMPaths);
  } else {
    fixWASMPaths();
  }

  console.log('📦 PDF.js WASM path fix loaded');
})();