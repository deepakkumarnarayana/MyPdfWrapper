import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Paper,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  ButtonGroup,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Tooltip,
  Divider,
  Stack,
  Card,
  CardContent,
} from '@mui/material'
import {
  NavigateBefore,
  NavigateNext,
  ZoomIn,
  ZoomOut,
  Refresh,
  ViewStream,
  ViewDay,
  PictureAsPdf,
} from '@mui/icons-material'
import { PDF } from '../types'

interface PDFViewerProps {
  pdf: PDF
}

export function PDFViewer({ pdf }: PDFViewerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewerType, setViewerType] = useState<'embedded' | 'custom'>('embedded')

  // For embedded PDF.js viewer, we'll use an iframe
  const pdfUrl = `/static/${pdf.filename}`
  const viewerUrl = `/pdfjs/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`

  if (error) {
    return (
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="center" 
        height="100%" 
        bgcolor="background.default"
        p={3}
      >
        <Alert 
          severity="error" 
          variant="outlined"
          sx={{ maxWidth: 400 }}
        >
          <Typography variant="subtitle1" gutterBottom>
            Error Loading PDF
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" height="100%" bgcolor="background.default">
      {/* PDF Viewer Header */}
      <Paper elevation={2} sx={{ borderRadius: 0 }}>
        <AppBar position="static" color="default" elevation={0}>
          <Toolbar variant="dense">
            <PictureAsPdf sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {pdf.original_filename}
            </Typography>
            
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title={viewerType === 'embedded' ? 'Switch to Custom Viewer' : 'Switch to Full PDF.js Viewer'}>
                <IconButton
                  onClick={() => setViewerType(viewerType === 'embedded' ? 'custom' : 'embedded')}
                  size="small"
                  color={viewerType === 'embedded' ? 'primary' : 'default'}
                >
                  {viewerType === 'embedded' ? <ViewDay /> : <ViewStream />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>
      </Paper>

      {/* PDF Viewer Content */}
      <Box flex={1} overflow="hidden">
        {viewerType === 'embedded' ? (
          <EmbeddedPDFViewer pdfUrl={pdfUrl} onLoad={() => setLoading(false)} onError={setError} />
        ) : (
          <CustomPDFViewer pdf={pdf} />
        )}
      </Box>
    </Box>
  )
}

// Embedded PDF.js Viewer Component
interface EmbeddedPDFViewerProps {
  pdfUrl: string
  onLoad: () => void
  onError: (error: string) => void
}

function EmbeddedPDFViewer({ pdfUrl, onLoad, onError }: EmbeddedPDFViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  
  const handleLoad = () => {
    onLoad()
  }
  
  const handleError = () => {
    onError('Failed to load PDF viewer')
  }
  
  // Construct the viewer URL with the PDF file
  const viewerUrl = `/pdfjs/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`
  
  return (
    <Box 
      component="iframe"
      ref={iframeRef}
      src={viewerUrl}
      width="100%"
      height="100%"
      border="none"
      onLoad={handleLoad}
      onError={handleError}
      sx={{
        backgroundColor: 'white',
        '&:focus': {
          outline: 'none',
        }
      }}
    />
  )
}

// Custom PDF Viewer Component (our original implementation)
interface CustomPDFViewerProps {
  pdf: PDF
}

function CustomPDFViewer({ pdf }: CustomPDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadPDF = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Dynamic import of PDF.js
        const pdfjsLib = await import('pdfjs-dist')
        
        // Set worker path - use local npm dependency
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()
        
        // Construct PDF URL - use proxied static path
        const pdfUrl = `/static/${pdf.filename}`
        
        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({
          url: pdfUrl,
        })
        
        const doc = await loadingTask.promise
        
        setPdfDoc(doc)
        setCurrentPage(1)
        setLoading(false)
      } catch (err) {
        console.error('Error loading PDF:', err)
        setError(`Failed to load PDF: ${err instanceof Error ? err.message : 'Unknown error'}`)
        setLoading(false)
      }
    }

    loadPDF()
  }, [pdf])

  const goToPage = (pageNumber: number) => {
    if (pdfDoc && pageNumber >= 1 && pageNumber <= pdfDoc.numPages) {
      setCurrentPage(pageNumber)
    }
  }

  const zoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0))
  }

  const zoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const resetZoom = () => {
    setScale(1.0)
  }

  if (loading) {
    return (
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="center" 
        height="100%" 
        bgcolor="background.default"
      >
        <Stack alignItems="center" spacing={2}>
          <CircularProgress size={40} />
          <Typography variant="body1" color="text.secondary">
            Loading PDF...
          </Typography>
        </Stack>
      </Box>
    )
  }

  if (error) {
    return (
      <Box 
        display="flex" 
        alignItems="center" 
        justifyContent="center" 
        height="100%" 
        bgcolor="background.default"
        p={3}
      >
        <Alert 
          severity="error" 
          variant="outlined"
          sx={{ maxWidth: 400 }}
        >
          <Typography variant="subtitle1" gutterBottom>
            Error Loading PDF
          </Typography>
          <Typography variant="body2">
            {error}
          </Typography>
        </Alert>
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" height="100%">
      {/* Custom PDF Controls */}
      <Paper elevation={1} sx={{ borderRadius: 0 }}>
        <Toolbar variant="dense">
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title="Previous Page">
                <IconButton
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  size="small"
                >
                  <NavigateBefore />
                </IconButton>
              </Tooltip>
              
              <Chip 
                label={`Page ${currentPage} of ${pdfDoc?.numPages || 0}`}
                variant="outlined"
                size="small"
                color="primary"
              />
              
              <Tooltip title="Next Page">
                <IconButton
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={!pdfDoc || currentPage >= pdfDoc.numPages}
                  size="small"
                >
                  <NavigateNext />
                </IconButton>
              </Tooltip>
            </Stack>
            
            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
            
            <ButtonGroup variant="outlined" size="small">
              <Tooltip title="Zoom Out">
                <IconButton onClick={zoomOut} size="small">
                  <ZoomOut />
                </IconButton>
              </Tooltip>
              
              <Button variant="outlined" size="small" sx={{ minWidth: 70 }}>
                {Math.round(scale * 100)}%
              </Button>
              
              <Tooltip title="Zoom In">
                <IconButton onClick={zoomIn} size="small">
                  <ZoomIn />
                </IconButton>
              </Tooltip>
            </ButtonGroup>
            
            <Tooltip title="Reset Zoom">
              <IconButton onClick={resetZoom} size="small">
                <Refresh />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </Paper>

      {/* PDF Content */}
      <Box 
        flex={1} 
        overflow="auto" 
        p={2}
        bgcolor="grey.50"
      >
        <Box maxWidth="4xl" mx="auto">
          <SimplePDFScroller 
            pdfDoc={pdfDoc} 
            scale={scale} 
          />
        </Box>
      </Box>
    </Box>
  )
}

interface PDFPageProps {
  pdfDoc: any
  pageNumber: number
  scale: number
}

function PDFPage({ pdfDoc, pageNumber, scale }: PDFPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textLayerRef = useRef<HTMLDivElement>(null)
  const renderTaskRef = useRef<any>(null)
  const [rendering, setRendering] = useState(false)

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return

    const renderPage = async () => {
      try {
        // Cancel any previous render task
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel()
          renderTaskRef.current = null
        }
        
        setRendering(true)
        
        const page = await pdfDoc.getPage(pageNumber)
        const viewport = page.getViewport({ scale })
        
        const canvas = canvasRef.current!
        const context = canvas.getContext('2d')!
        const textLayerDiv = textLayerRef.current!
        
        // Set canvas dimensions
        canvas.height = viewport.height
        canvas.width = viewport.width
        
        // Clear previous text layer content
        textLayerDiv.innerHTML = ''
        textLayerDiv.style.width = viewport.width + 'px'
        textLayerDiv.style.height = viewport.height + 'px'
        
        // Render canvas
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }
        
        renderTaskRef.current = page.render(renderContext)
        
        // Get text content for text layer
        const textContent = await page.getTextContent()
        
        // Wait for canvas to finish rendering
        await renderTaskRef.current.promise
        
        // Check if component is still mounted
        if (!canvasRef.current || !textLayerRef.current) return
        
        // Render text layer
        const pdfjsLib = await import('pdfjs-dist')
        
        // Create text layer using PDF.js built-in text layer builder
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport
        })
        
        await textLayer.render()
        
        setRendering(false)
        renderTaskRef.current = null
      } catch (err: any) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err)
        }
        setRendering(false)
        renderTaskRef.current = null
      }
    }

    renderPage()

    // Cleanup function
    return () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel()
        renderTaskRef.current = null
      }
    }
  }, [pdfDoc, pageNumber, scale])

  return (
    <Box 
      position="relative" 
      bgcolor="white"
      sx={{ 
        borderRadius: 1,
        overflow: 'hidden',
        '& canvas': {
          maxWidth: '100%',
          height: 'auto',
          display: 'block',
        }
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ 
          opacity: rendering ? 0.5 : 1,
          transition: 'opacity 0.2s ease-in-out'
        }}
      />
      {/* Text layer for text selection */}
      <div
        ref={textLayerRef}
        className="text-layer"
      />
      {rendering && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bgcolor="rgba(255, 255, 255, 0.8)"
          zIndex={20}
        >
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  )
}

interface SimplePDFScrollerProps {
  pdfDoc: any
  scale: number
}

function SimplePDFScroller({ pdfDoc, scale }: SimplePDFScrollerProps) {
  const [loadedPages, setLoadedPages] = useState<number[]>([1, 2, 3])
  const [loading, setLoading] = useState(false)

  const loadMorePages = useCallback(() => {
    if (loading || !pdfDoc) return
    
    const maxLoaded = Math.max(...loadedPages)
    if (maxLoaded >= pdfDoc.numPages) return
    
    setLoading(true)
    const nextPages = Array.from(
      { length: Math.min(3, pdfDoc.numPages - maxLoaded) }, 
      (_, i) => maxLoaded + i + 1
    )
    
    setTimeout(() => {
      setLoadedPages(prev => [...prev, ...nextPages])
      setLoading(false)
    }, 100)
  }, [loadedPages, loading, pdfDoc])

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      if (target.scrollTop + target.clientHeight >= target.scrollHeight - 100) {
        loadMorePages()
      }
    }

    const container = document.querySelector('.flex-1.overflow-auto')
    if (container) {
      container.addEventListener('scroll', handleScroll)
      return () => container.removeEventListener('scroll', handleScroll)
    }
  }, [loadMorePages])

  if (!pdfDoc) return null

  return (
    <Stack spacing={3}>
      {loadedPages.map(pageNum => (
        <Card key={pageNum} elevation={3}>
          <CardContent sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Chip 
                label={`Page ${pageNum}`}
                variant="outlined"
                size="small"
                color="primary"
                sx={{ alignSelf: 'flex-start' }}
              />
              <PDFPage
                pdfDoc={pdfDoc}
                pageNumber={pageNum}
                scale={scale}
              />
            </Stack>
          </CardContent>
        </Card>
      ))}
      {loading && (
        <Box textAlign="center" py={4}>
          <Stack alignItems="center" spacing={2}>
            <CircularProgress size={24} />
            <Typography variant="body2" color="text.secondary">
              Loading more pages...
            </Typography>
          </Stack>
        </Box>
      )}
    </Stack>
  )
}

