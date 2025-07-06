import { useState } from 'react'
import { Box, Typography, Container, Paper, Drawer } from '@mui/material'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { PDFViewer } from './components/PDFViewer'
import { FlashcardPanel } from './components/FlashcardPanel'
import { UploadArea } from './components/UploadArea'
import { PDFDebug } from './components/PDFDebug'
import { usePDFStore } from './stores/pdfStore'

const SIDEBAR_WIDTH = 320
const FLASHCARD_PANEL_WIDTH = 384

function App() {
  const { currentPDF, pdfs } = usePDFStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <Box display="flex" flexDirection="column" height="100vh">
      <Header />
      
      <Box display="flex" flex={1} overflow="hidden">
        <Drawer
          variant="persistent"
          anchor="left"
          open={sidebarOpen}
          sx={{
            width: sidebarOpen ? SIDEBAR_WIDTH : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              boxSizing: 'border-box',
              position: 'relative',
              border: 'none',
              borderRight: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          <Sidebar 
            open={sidebarOpen} 
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />
        </Drawer>
        
        <Box display="flex" flex={1} overflow="hidden">
          <Box component="main" flex={1} overflow="hidden">
            {currentPDF ? (
              <PDFViewer pdf={currentPDF} />
            ) : (
              <Box 
                display="flex" 
                alignItems="center" 
                justifyContent="center" 
                height="100%"
                bgcolor="background.default"
                p={3}
              >
                {pdfs.length > 0 ? (
                  <Box textAlign="center">
                    <Typography variant="h4" gutterBottom color="text.primary">
                      Select a PDF to get started
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      Choose a PDF from the sidebar to begin studying
                    </Typography>
                  </Box>
                ) : (
                  <Container maxWidth="lg">
                    <Box display="flex" flexDirection="column" gap={4}>
                      <UploadArea />
                      <PDFDebug />
                    </Box>
                  </Container>
                )}
              </Box>
            )}
          </Box>
          
          {currentPDF && (
            <Paper 
              elevation={2}
              sx={{ 
                width: FLASHCARD_PANEL_WIDTH,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 0,
                borderLeft: '1px solid',
                borderColor: 'divider',
              }}
            >
              <FlashcardPanel pdf={currentPDF} />
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  )
}

export default App