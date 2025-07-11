import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tooltip,
  Divider,
  Select,
  MenuItem,
  FormControl,
  Box,
  Chip,
  TextField,
} from '@mui/material';
import {
  ArrowBack,
  ZoomIn,
  ZoomOut,
  NavigateBefore,
  NavigateNext,
  FirstPage,
  LastPage,
  Palette,
  RotateLeft,
  RotateRight,
  Toc,
  Brightness4,
  Brightness7,
} from '@mui/icons-material';

export const PdfToolbar = ({
  bookTitle,
  handleBack,
  toggleToc,
  tocItems,
  goToFirstPage,
  goToPreviousPage,
  goToNextPage,
  goToLastPage,
  currentPage,
  totalPages,
  pageInput,
  handlePageInputChange,
  handlePageInputSubmit,
  zoomOptions,
  zoomSelect,
  handleZoomChange,
  rotateLeft,
  rotateRight,
  highlightColors,
  highlightColor,
  setHighlightColor,
  darkMode,
  setDarkMode,
}) => (
  <AppBar position="static" elevation={0} sx={{ backgroundColor: '#474747', color: 'white' }}>
    <Toolbar sx={{ minHeight: '48px !important', py: 0 }}>
      <IconButton edge="start" color="inherit" onClick={handleBack} sx={{ mr: 1 }}>
        <ArrowBack />
      </IconButton>
      <Tooltip title="Table of Contents">
        <IconButton color="inherit" onClick={toggleToc} sx={{ mr: 2 }}>
          <Toc />
        </IconButton>
      </Tooltip>
      <Typography variant="h6" sx={{ flexGrow: 1, fontSize: '1rem' }}>
        {bookTitle}
        {tocItems.length > 0 && (
          <Chip 
            label={`${tocItems.length} ${tocItems.length === 1 ? 'section' : 'sections'}`}
            size="small"
            sx={{ ml: 2, backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
          />
        )}
      </Typography>
      
      {/* Page Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="First Page">
          <span>
            <IconButton color="inherit" onClick={goToFirstPage} disabled={currentPage === 1} size="small"><FirstPage /></IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Previous Page">
          <span>
            <IconButton color="inherit" onClick={goToPreviousPage} disabled={currentPage === 1} size="small"><NavigateBefore /></IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Next Page">
          <span>
            <IconButton color="inherit" onClick={goToNextPage} disabled={currentPage === totalPages} size="small"><NavigateNext /></IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Last Page">
          <span>
            <IconButton color="inherit" onClick={goToLastPage} disabled={currentPage === totalPages} size="small"><LastPage /></IconButton>
          </span>
        </Tooltip>
        <TextField
          size="small"
          value={pageInput}
          onChange={handlePageInputChange}
          onKeyPress={(e) => e.key === 'Enter' && handlePageInputSubmit()}
          onBlur={handlePageInputSubmit}
          sx={{ width: 50, '& .MuiInputBase-root': { height: 32, color: 'white', '& input': { textAlign: 'center', p: 0.5 } }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' } }}
        />
        <Typography variant="body2" sx={{ mx: 1 }}>of {totalPages}</Typography>
      </Box>
      
      <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.3)' }} />
      
      {/* Zoom Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Zoom Out">
          <span>
            <IconButton color="inherit" onClick={() => { const i = zoomOptions.findIndex(o => o.value === zoomSelect); if (i > 0) handleZoomChange(zoomOptions[i - 1].value); }} disabled={zoomSelect === '25'} size="small"><ZoomOut /></IconButton>
          </span>
        </Tooltip>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Select value={zoomSelect} onChange={(e) => handleZoomChange(e.target.value)} sx={{ color: 'white', height: 32, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '& .MuiSvgIcon-root': { color: 'white' } }}>
            {zoomOptions.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </Select>
        </FormControl>
        <Tooltip title="Zoom In">
          <span>
            <IconButton color="inherit" onClick={() => { const i = zoomOptions.findIndex(o => o.value === zoomSelect); if (i < zoomOptions.length - 3) handleZoomChange(zoomOptions[i + 1].value); }} disabled={zoomSelect === '400'} size="small"><ZoomIn /></IconButton>
          </span>
        </Tooltip>
      </Box>
      
      <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.3)' }} />
      
      {/* Rotation Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Rotate Left"><IconButton color="inherit" onClick={rotateLeft} size="small"><RotateLeft /></IconButton></Tooltip>
        <Tooltip title="Rotate Right"><IconButton color="inherit" onClick={rotateRight} size="small"><RotateRight /></IconButton></Tooltip>
      </Box>
      
      <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.3)' }} />
      
      {/* Highlight Controls */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Tooltip title="Highlight Color"><IconButton color="inherit" size="small"><Palette /></IconButton></Tooltip>
        {highlightColors.map(color => (
          <Box key={color} sx={{ width: 20, height: 20, backgroundColor: color, border: highlightColor === color ? '2px solid white' : '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', cursor: 'pointer', '&:hover': { opacity: 0.8 } }} onClick={() => setHighlightColor(color)} />
        ))}
      </Box>

      <Divider orientation="vertical" flexItem sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.3)' }} />

      <Tooltip title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
        <IconButton color="inherit" onClick={() => setDarkMode(!darkMode)}>
          {darkMode ? <Brightness7 /> : <Brightness4 />}
        </IconButton>
      </Tooltip>
    </Toolbar>
  </AppBar>
);
