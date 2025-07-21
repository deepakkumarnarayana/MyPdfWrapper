import React from 'react';
import {
  Menu,
  MenuItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Highlight as HighlightIcon,
  TextFields,
} from '@mui/icons-material';
import { ContextMenuState } from '../types';

interface PdfContextMenuProps {
  contextMenu: ContextMenuState | null;
  highlightColor: string;
  onClose: () => void;
  onAddHighlight: (color: string) => void;
  onDeleteHighlight: (highlightId: string) => void;
  onCopyText: (text: string) => void;
}

export const PdfContextMenu: React.FC<PdfContextMenuProps> = ({
  contextMenu,
  highlightColor,
  onClose,
  onAddHighlight,
  onDeleteHighlight,
  onCopyText,
}) => {
  // Enhanced close handler to ensure proper focus management
  const handleClose = () => {
    // Clear any focused elements
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    onClose();
  };

  return (
    <Menu
      open={contextMenu !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        contextMenu !== null
          ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
          : { top: 0, left: 0 }
      }
      disableAutoFocus={true}
      disableEnforceFocus={true}
      disableRestoreFocus={true}
      slotProps={{
        paper: {
          'aria-hidden': false,
        },
      }}
    >
      {contextMenu?.highlightId ? (
        // Context menu for existing highlights
        <MenuItem 
          onClick={() => {
            contextMenu.highlightId && onDeleteHighlight(contextMenu.highlightId);
            handleClose();
          }}
          tabIndex={-1}
        >
          <ListItemIcon>
            <HighlightIcon sx={{ color: 'red' }} />
          </ListItemIcon>
          <ListItemText>Delete Highlight</ListItemText>
        </MenuItem>
      ) : (
        // Context menu for text selection
        <>
          <MenuItem 
            onClick={() => {
              onAddHighlight(highlightColor);
              handleClose();
            }}
            tabIndex={-1}
          >
            <ListItemIcon>
              <HighlightIcon sx={{ color: highlightColor }} />
            </ListItemIcon>
            <ListItemText>Highlight</ListItemText>
          </MenuItem>
          <MenuItem 
            onClick={() => {
              onCopyText(contextMenu?.text || '');
              handleClose();
            }}
            tabIndex={-1}
          >
            <ListItemIcon>
              <TextFields />
            </ListItemIcon>
            <ListItemText>Copy Text</ListItemText>
          </MenuItem>
        </>
      )}
    </Menu>
  );
};