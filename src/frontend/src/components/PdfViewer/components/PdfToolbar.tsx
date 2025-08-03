import React, { useState } from 'react';
import { TocItem } from '../hooks/useTableOfContents';
import { HighlightSettings } from '../types';

interface PdfToolbarProps {
  bookTitle: string;
  handleBack: () => void;
  toggleToc: () => void;
  tocItems: TocItem[];
  goToFirstPage: () => void;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  goToLastPage: () => void;
  currentPage: number;
  totalPages: number;
  pageInput: string;
  handlePageInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handlePageInputSubmit: () => void;
  zoomOptions: { value: string; label: string }[];
  zoomSelect: string;
  handleZoomChange: (value: string) => void;
  rotateLeft: () => void;
  rotateRight: () => void;
  setHighlightColor: (color: string) => void;
  highlightSettings: HighlightSettings;
  updateHighlightSettings: (settings: Partial<HighlightSettings>) => void;
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
}
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
  Popover,
  Paper,
  Slider,
  FormControlLabel,
  Switch,
  Stack,
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
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';

export const PdfToolbar: React.FC<PdfToolbarProps> = ({
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
  setHighlightColor,
  highlightSettings,
  updateHighlightSettings,
  darkMode,
  setDarkMode,
}) => {
  const [highlightMenuAnchor, setHighlightMenuAnchor] = useState<HTMLElement | null>(null);
  const [expandedHighlight, setExpandedHighlight] = useState(false);

  const handleHighlightMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setHighlightMenuAnchor(event.currentTarget);
    setExpandedHighlight(!expandedHighlight);
  };

  const handleCloseHighlightMenu = () => {
    setHighlightMenuAnchor(null);
    setExpandedHighlight(false);
  };

  return (
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
            <IconButton color="inherit" onClick={() => { const i = zoomOptions.findIndex(o => o.value === zoomSelect); if (i > 0) handleZoomChange(zoomOptions[i - 1]?.value || '25'); }} disabled={zoomSelect === '25'} size="small"><ZoomOut /></IconButton>
          </span>
        </Tooltip>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <Select value={zoomSelect} onChange={(e) => handleZoomChange(e.target.value)} sx={{ color: 'white', height: 32, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' }, '& .MuiSvgIcon-root': { color: 'white' } }}>
            {zoomOptions.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
          </Select>
        </FormControl>
        <Tooltip title="Zoom In">
          <span>
            <IconButton color="inherit" onClick={() => { const i = zoomOptions.findIndex(o => o.value === zoomSelect); if (i < zoomOptions.length - 3) handleZoomChange(zoomOptions[i + 1]?.value || '400'); }} disabled={zoomSelect === '400'} size="small"><ZoomIn /></IconButton>
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
        <Tooltip title={expandedHighlight ? "Close Highlight Panel" : "Open Highlight Panel"}>
          <IconButton 
            color="inherit" 
            size="small" 
            onClick={handleHighlightMenuClick}
            sx={{ 
              backgroundColor: expandedHighlight ? 'rgba(255,255,255,0.2)' : 'transparent',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.3)' }
            }}
          >
            <Palette />
            {expandedHighlight ? <ExpandLess sx={{ ml: 0.5 }} /> : <ExpandMore sx={{ ml: 0.5 }} />}
          </IconButton>
        </Tooltip>
        
        {/* Current selected color indicator */}
        <Box 
          sx={{ 
            width: 24, 
            height: 24, 
            backgroundColor: highlightSettings.selectedColor, 
            border: '2px solid white', 
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }} 
        />
        
        {/* Highlight Settings Popover */}
        <Popover
          open={Boolean(highlightMenuAnchor) && expandedHighlight}
          anchorEl={highlightMenuAnchor}
          onClose={handleCloseHighlightMenu}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          sx={{ mt: 1 }}
        >
          <Paper sx={{ p: 2, minWidth: 280, maxWidth: 320 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Highlight Settings
            </Typography>
            
            {/* Color Selection */}
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Highlight color
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {highlightSettings.defaultColors.map(colorOption => (
                <Tooltip key={colorOption.name} title={colorOption.displayName}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      backgroundColor: colorOption.value,
                      border: highlightSettings.selectedColor === colorOption.value 
                        ? '3px solid #1976d2' 
                        : '2px solid rgba(0,0,0,0.12)',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': { 
                        transform: 'scale(1.1)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                      }
                    }}
                    onClick={() => {
                      updateHighlightSettings({ selectedColor: colorOption.value });
                      setHighlightColor(colorOption.value);
                    }}
                  />
                </Tooltip>
              ))}
            </Stack>
            
            {/* Thickness Control */}
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Thickness
            </Typography>
            <Box sx={{ px: 1, mb: 2 }}>
              <Slider
                value={highlightSettings.thickness}
                onChange={(_, value) => updateHighlightSettings({ thickness: value as number })}
                min={1}
                max={24}
                step={1}
                marks={[
                  { value: 1, label: '1' },
                  { value: 12, label: '12' },
                  { value: 24, label: '24' },
                ]}
                valueLabelDisplay="auto"
                size="small"
                sx={{
                  color: highlightSettings.selectedColor,
                  '& .MuiSlider-thumb': {
                    backgroundColor: highlightSettings.selectedColor,
                  },
                  '& .MuiSlider-track': {
                    backgroundColor: highlightSettings.selectedColor,
                  },
                }}
              />
            </Box>
            
            {/* Show All Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={highlightSettings.showAll}
                  onChange={(e) => updateHighlightSettings({ showAll: e.target.checked })}
                  size="small"
                />
              }
              label={
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Show all highlights
                </Typography>
              }
              sx={{ m: 0 }}
            />
          </Paper>
        </Popover>
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
};