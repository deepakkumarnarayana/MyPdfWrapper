import { useState } from 'react'
import { usePDFStore } from '../stores/pdfStore'

export function Header() {
  const { currentPDF, error, clearError } = usePDFStore()
  const [showError, setShowError] = useState(true)

  const handleCloseError = () => {
    setShowError(false)
    clearError()
  }

  return (
    <header className="bg-white border-b border-surface-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-surface-900">
            Study PDF Reader
          </h1>
          {currentPDF && (
            <div className="flex items-center space-x-2 text-sm text-surface-600">
              <span>•</span>
              <span className="font-medium">{currentPDF.title || currentPDF.original_filename}</span>
              {currentPDF.page_count && (
                <span className="text-surface-400">
                  ({currentPDF.page_count} pages)
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-surface-500">
            AI-powered learning assistant
          </span>
        </div>
      </div>
      
      {error && showError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={handleCloseError}
              className="text-red-500 hover:text-red-700 text-sm font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </header>
  )
}