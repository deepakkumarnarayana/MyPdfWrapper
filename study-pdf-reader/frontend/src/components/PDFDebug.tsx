import { useState } from 'react'
import { usePDFStore } from '../stores/pdfStore'

export function PDFDebug() {
  const { pdfs } = usePDFStore()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const checkBackendStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:8000/debug/storage')
      const data = await response.json()
      setDebugInfo(data)
    } catch (error) {
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
    setLoading(false)
  }

  const testPDFWorker = async () => {
    try {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js'
      
      setDebugInfo({
        pdfjs_version: pdfjsLib.version,
        worker_src: pdfjsLib.GlobalWorkerOptions.workerSrc,
        test: 'PDF.js loaded successfully'
      })
    } catch (error) {
      setDebugInfo({ 
        error: 'PDF.js failed to load',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return (
    <div className="p-4 bg-surface-100 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">PDF Debug Panel</h3>
      
      <div className="space-y-4">
        <div>
          <h4 className="font-medium">Frontend PDFs ({pdfs.length}):</h4>
          <ul className="text-sm text-surface-600">
            {pdfs.map(pdf => (
              <li key={pdf.id}>
                {pdf.original_filename} → {pdf.filename}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-x-2">
          <button 
            onClick={checkBackendStatus}
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? 'Checking...' : 'Check Backend Storage'}
          </button>
          
          <button 
            onClick={testPDFWorker}
            className="btn btn-secondary"
          >
            Test PDF.js Worker
          </button>
        </div>

        {debugInfo && (
          <div className="bg-white p-3 rounded border">
            <h4 className="font-medium mb-2">Debug Info:</h4>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}