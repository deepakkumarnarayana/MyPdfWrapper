import React from 'react';
import { TocItem } from '../hooks/useTableOfContents';

interface TocRendererProps {
  items: TocItem[];
  onItemClick: (item: TocItem) => void;
  onItemToggle: (item: TocItem) => void;
  currentPage: number;
}

interface TableOfContentsDrawerProps {
  isTocOpen: boolean;
  toggleToc: () => void;
  tocItems: TocItem[];
  tocLoading: boolean;
  handleTocItemClick: (item: TocItem) => void;
  handleTocItemToggle: (item: TocItem) => void;
  currentPage: number;
}
import {
  Drawer,
  Box,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Collapse,
  IconButton,
} from '@mui/material';
import { Article, ExpandLess, ExpandMore } from '@mui/icons-material';

// This component is defined here because it's recursive and tightly coupled
const TocRenderer: React.FC<TocRendererProps> = ({ items, onItemClick, onItemToggle, currentPage }) => (
  <List dense component="div" disablePadding>
    {items.map((item, index) => (
      <React.Fragment key={`${item.title}-${index}`}>
        <ListItem
          sx={{ pl: 2 * item.level }}
          disablePadding
          secondaryAction={
            item.items && item.items.length > 0 ? (
              <IconButton edge="end" size="small" onClick={() => onItemToggle(item)}>
                {item.expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            ) : null
          }
        >
          <ListItemButton onClick={() => onItemClick(item)}>
            <ListItemText
              primary={item.title}
              primaryTypographyProps={{ 
                sx: { 
                  fontSize: '0.9rem', 
                  fontWeight: currentPage === item.pageNumber ? 'bold' : 'normal',
                  color: currentPage === item.pageNumber ? 'primary.main' : 'inherit',
                } 
              }}
            />
            {item.pageNumber && (
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', pr: 1 }}>
                {item.pageNumber}
              </Typography>
            )}
          </ListItemButton>
        </ListItem>
        {item.items && item.items.length > 0 && (
          <Collapse in={item.expanded} timeout="auto" unmountOnExit>
            <TocRenderer items={item.items} onItemClick={onItemClick} onItemToggle={onItemToggle} currentPage={currentPage} />
          </Collapse>
        )}
      </React.Fragment>
    ))}
  </List>
);

export const TableOfContentsDrawer: React.FC<TableOfContentsDrawerProps> = ({
  isTocOpen,
  toggleToc,
  tocItems,
  tocLoading,
  handleTocItemClick,
  handleTocItemToggle,
  currentPage,
}) => (
  <Drawer
    anchor="left"
    open={isTocOpen}
    onClose={toggleToc}
    variant="temporary"
    sx={{
      '& .MuiDrawer-paper': {
        width: 320,
        backgroundColor: '#2e2e2e',
        color: 'white',
        top: '48px', // Below the toolbar
        height: 'calc(100vh - 48px)',
      },
    }}
  >
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Article />
        Table of Contents
        {tocLoading && <CircularProgress size={16} sx={{ color: 'white' }} />}
      </Typography>
      
      {tocItems.length > 0 ? (
        <TocRenderer items={tocItems} onItemClick={handleTocItemClick} onItemToggle={handleTocItemToggle} currentPage={currentPage} />
      ) : (
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          {tocLoading ? 'Loading table of contents...' : 'No table of contents available'}
        </Typography>
      )}
    </Box>
  </Drawer>
);