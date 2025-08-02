import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    mimeTypes: {
      'application/wasm': ['wasm']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/static': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2022',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        }
      }
    }
  },
  esbuild: {
    target: 'es2022'
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['react-pdf'],
    esbuildOptions: {
      target: 'es2022',
    },
  },
  worker: {
    format: 'es'
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})