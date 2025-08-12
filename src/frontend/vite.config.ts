import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // PDF.js assets are already available in public/pdfjs-full/
    // No need for vite-plugin-static-copy
  ],
  server: {
    port: 3000,
    host: true,
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
