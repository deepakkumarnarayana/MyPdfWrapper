import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.mjs',
          dest: '.'
        },
        {
          src: 'node_modules/pdfjs-dist/web/viewer.html',
          dest: 'pdfjs-full'
        },
        {
          src: 'node_modules/pdfjs-dist/web/viewer.css',
          dest: 'pdfjs-full'
        },
        {
          src: 'node_modules/pdfjs-dist/web/viewer.mjs',
          dest: 'pdfjs-full'
        },
        {
          src: 'node_modules/pdfjs-dist/web/images',
          dest: 'pdfjs-full'
        },
        {
          src: 'node_modules/pdfjs-dist/cmaps',
          dest: 'pdfjs-full'
        },
        {
          src: 'node_modules/pdfjs-dist/standard_fonts',
          dest: 'pdfjs-full'
        }
      ]
    })
  ],
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