import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker and other paths globally using the correct assets
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs-full/build/pdf.worker.mjs';

// Set global default document parameters for PDF.js
// These will be used as defaults when calling getDocument()
export const PDF_DEFAULT_OPTIONS = {
  cMapUrl: '/pdfjs-full/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs-full/standard_fonts/',
};

// Create a client
const queryClient = new QueryClient();

async function enableMocking() {
  // Only enable MSW when in development AND no backend URL is configured
  if (import.meta.env.DEV && !import.meta.env.VITE_API_BASE_URL) {
    const { worker } = await import('./mocks/browser');
    return worker.start();
  }
}

enableMocking().then(() => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
});