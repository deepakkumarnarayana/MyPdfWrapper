import React, { memo } from 'react';
import {
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Highlight, TextFields } from '@mui/icons-material';

const PdfContextMenuComponent = ({
  contextMenu,
  setContextMenu,
  deleteHighlight,
  addHighlight,
  highlightColor,
}) => {
  console.log('🎭 PdfContextMenu rendering:', { 
    isOpen: contextMenu !== null, 
    hasText: !!contextMenu?.text 
  });
  
  return (
  <Menu
    open={contextMenu !== null}
    onClose={() => setContextMenu()}
    anchorReference="anchorPosition"
    {...(contextMenu !== null && {
      anchorPosition: { top: contextMenu.mouseY, left: contextMenu.mouseX }
    })}
    disableAutoFocus
    disableEnforceFocus
    disableRestoreFocus
    keepMounted={true}
    slotProps={{
      root: {
        style: { zIndex: 9999 }
      }
    }}
  >
    {contextMenu?.highlightId ? (
      <MenuItem onClick={() => deleteHighlight(contextMenu.highlightId!)}>
        <ListItemIcon><Highlight sx={{ color: 'red' }} /></ListItemIcon>
        <ListItemText>Delete Highlight</ListItemText>
      </MenuItem>
    ) : (
      <>
        <MenuItem onClick={() => addHighlight(highlightColor)}>
          <ListItemIcon><Highlight sx={{ color: highlightColor }} /></ListItemIcon>
          <ListItemText>Highlight</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => {
          if (contextMenu?.text) {
            navigator.clipboard.writeText(contextMenu.text);
          }
          setContextMenu();
        }}>
          <ListItemIcon><TextFields /></ListItemIcon>
          <ListItemText>Copy Text</ListItemText>
        </MenuItem>
      </>
    )}
  </Menu>
  );
};

export const PdfContextMenu = memo(PdfContextMenuComponent);
