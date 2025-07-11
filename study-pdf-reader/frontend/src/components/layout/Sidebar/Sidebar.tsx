import React from 'react';
import { 
  Drawer, 
  List, 
  ListItem, 
  ListItemButton, 
  ListItemIcon, 
  ListItemText, 
  useTheme, 
  Box, 
  IconButton,
  Typography,
  Chip,
  Divider
} from '@mui/material';
import { 
  Dashboard as DashboardIcon,
  MenuBook as BookIcon,
  School as SessionIcon,
  Psychology as FlashcardIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight
} from '@mui/icons-material';
import { SidebarItem } from '../../../types';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const theme = useTheme();

  const sidebarItems: SidebarItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, path: '/', active: true },
    { id: 'books', label: 'My Books', icon: <BookIcon />, path: '/books', badge: 4 },
    { id: 'sessions', label: 'Study Sessions', icon: <SessionIcon />, path: '/sessions', badge: 3 },
    { id: 'flashcards', label: 'Flashcards', icon: <FlashcardIcon />, path: '/flashcards', badge: 99 },
    { id: 'analytics', label: 'Analytics', icon: <AnalyticsIcon />, path: '/analytics' },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon />, path: '/settings' },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: collapsed ? theme.custom.sidebar.collapsedWidth : theme.custom.sidebar.width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: collapsed ? theme.custom.sidebar.collapsedWidth : theme.custom.sidebar.width,
          boxSizing: 'border-box',
          transition: theme.transitions.create('width'),
          overflowX: 'hidden',
          bgcolor: '#f8fafc',
          borderRight: '1px solid #e2e8f0',
        },
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {!collapsed && (
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary' }}>
            Navigation
          </Typography>
        )}
        <IconButton onClick={onToggle} size="small">
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </IconButton>
      </Box>
      
      <Divider />
      
      <List sx={{ px: 1, pt: 1 }}>
        {sidebarItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ display: 'block', mb: 0.5 }}>
            <ListItemButton
              sx={{
                minHeight: 48,
                justifyContent: collapsed ? 'center' : 'initial',
                px: 2,
                borderRadius: 2,
                mx: 0.5,
                bgcolor: item.active ? 'primary.main' : 'transparent',
                color: item.active ? 'white' : 'text.primary',
                '&:hover': {
                  bgcolor: item.active ? 'primary.dark' : 'action.hover',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: collapsed ? 'auto' : 2,
                  justifyContent: 'center',
                  color: item.active ? 'white' : 'primary.main',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {!collapsed && (
                <>
                  <ListItemText 
                    primary={item.label} 
                    sx={{ 
                      '& .MuiListItemText-primary': {
                        fontSize: '0.875rem',
                        fontWeight: item.active ? 600 : 500,
                      }
                    }} 
                  />
                  {item.badge && (
                    <Chip
                      label={item.badge === 99 ? '99+' : item.badge}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.75rem',
                        bgcolor: item.active ? 'rgba(255,255,255,0.2)' : 'grey.200',
                        color: item.active ? 'white' : 'grey.700',
                      }}
                    />
                  )}
                </>
              )}
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};