import { useEffect } from 'react'
import { usePDFStore } from '../stores/pdfStore'
import { PDF } from '../types'

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export function Sidebar({ open, onToggle }: SidebarProps) {
  const { pdfs, currentPDF, loading, selectPDF, loadPDFs, deletePDF } = usePDFStore()

  useEffect(() => {
    loadPDFs()
  }, [loadPDFs])

  const handleSelectPDF = (pdf: PDF) => {
    selectPDF(pdf)
  }

  const handleDeletePDF = async (pdf: PDF, event: React.MouseEvent) => {
    event.stopPropagation()
    if (window.confirm(`Are you sure you want to delete "${pdf.title || pdf.original_filename}"?`)) {
      await deletePDF(pdf.id)
    }
  }

  const formatFileSize = (bytes: number | undefined) => {
    if (!bytes) return ''
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  return (
    <aside className={`bg-white border-r border-surface-200 flex flex-col transition-all duration-300 ${
      open ? 'w-80' : 'w-16'
    }`}>
      <div className="p-4 border-b border-surface-200">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between text-left"
        >
          {open && <span className="font-medium text-surface-900">PDF Library</span>}
          <svg
            className={`w-5 h-5 text-surface-500 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-4 text-center text-surface-500">
            <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            {open && <span className="text-sm">Loading PDFs...</span>}
          </div>
        )}

        {!loading && pdfs.length === 0 && (
          <div className="p-4 text-center text-surface-500">
            {open && (
              <div>
                <p className="text-sm mb-2">No PDFs uploaded yet</p>
                <p className="text-xs text-surface-400">
                  Upload your first PDF to get started
                </p>
              </div>
            )}
          </div>
        )}

        {!loading && pdfs.length > 0 && (
          <div className="space-y-1 p-2">
            {pdfs.map(pdf => (
              <div
                key={pdf.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  currentPDF?.id === pdf.id
                    ? 'bg-primary-50 border border-primary-200'
                    : 'hover:bg-surface-50'
                }`}
                onClick={() => handleSelectPDF(pdf)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {open && (
                      <>
                        <h3 className="font-medium text-surface-900 truncate text-sm">
                          {pdf.title || pdf.original_filename}
                        </h3>
                        <div className="mt-1 space-y-1">
                          {pdf.author && (
                            <p className="text-xs text-surface-500 truncate">
                              by {pdf.author}
                            </p>
                          )}
                          <div className="flex items-center space-x-2 text-xs text-surface-400">
                            {pdf.page_count && <span>{pdf.page_count} pages</span>}
                            {pdf.file_size && <span>{formatFileSize(pdf.file_size)}</span>}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {open && (
                    <button
                      onClick={(e) => handleDeletePDF(pdf, e)}
                      className="ml-2 p-1 text-surface-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}