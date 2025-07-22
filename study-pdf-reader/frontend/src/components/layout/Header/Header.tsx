import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  InputBase,
  IconButton,
  Badge,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Popover,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Upload as UploadIcon,
  Settings,
  Logout,
} from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { User, NotificationItem } from '../../../types';
import { Button } from '../../ui/Button';

// Styled components
const SearchContainer = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginLeft: 0,
  width: '100%',
  maxWidth: 400,
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
  },
}));

interface HeaderProps {
  user?: User | null;
  isAuthenticated?: boolean;
  notifications?: NotificationItem[];
  onUpload?: () => void;
  onSearch?: (query: string) => void;
  onLogin?: () => void;
  onLogout?: () => void;
  onProfile?: () => void;
  uploadProgress?: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  isAuthenticated = false,
  notifications = [],
  onUpload,
  onSearch,
  onLogin,
  onLogout,
  onProfile,
  uploadProgress,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [notificationsAnchor, setNotificationsAnchor] = useState<null | HTMLElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      onSearch?.(searchQuery.trim());
    }
  };

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleNotificationsOpen = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationsAnchor(event.currentTarget);
  };

  const handleClose = () => {
    setUserMenuAnchor(null);
    setNotificationsAnchor(null);
  };

  return (
    <AppBar position="sticky" color="default" elevation={1}>
      {uploadProgress && uploadProgress > 0 && uploadProgress < 100 && (
        <LinearProgress variant="determinate" value={uploadProgress} />
      )}
      
      <Toolbar>
        {/* Logo and Title */}
        <Box display="flex" alignItems="center" sx={{ mr: 3 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 1.5 }}></Avatar>
          <Box>
            <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 600 }}>
              Study PDF Reader
            </Typography>
            <Typography variant="caption" color="text.secondary">
              AI-powered PDF learning application
            </Typography>
          </Box>
        </Box>

        {/* Search */}
        <SearchContainer>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="Search books, sessions, or cards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </SearchContainer>

        <Box sx={{ flexGrow: 1 }} />

        {/* Actions */}
        <Box display="flex" alignItems="center" gap={1}>
          {/* Upload Button */}
          <Button
            variant="primary"
            size="small"
            onClick={onUpload}
            loading={!!uploadProgress}
            icon={<UploadIcon />}
            disabled={!!uploadProgress}
          >
            {uploadProgress ? `${uploadProgress}%` : 'Upload PDF'}
          </Button>

          {/* Notifications */}
          <IconButton
            color="inherit"
            onClick={handleNotificationsOpen}
            sx={{ ml: 1 }}
          >
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>

          {/* User Menu */}
          {isAuthenticated && user ? (
            <>
              <IconButton
                onClick={handleUserMenuOpen}
                sx={{ ml: 1 }}
              >
                <Avatar sx={{ width: 32, height: 32 }}>
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              <Box ml={1}>
                <Typography variant="body2" fontWeight={500}>
                  {user.name}
                </Typography>
                <Chip
                  label={user.plan}
                  size="small"
                  color={user.plan === 'free' ? 'default' : 'primary'}
                />
              </Box>
            </>
          ) : (
            <Button variant="primary" size="small" onClick={onLogin}>
              Sign In
            </Button>
          )}
        </Box>
      </Toolbar>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        disableAutoFocus={true}
        disableEnforceFocus={true}
        disableRestoreFocus={true}
      >
        <MenuItem onClick={() => { onProfile?.(); handleClose(); }}>
          <Settings sx={{ mr: 1 }} />
          Profile Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { onLogout?.(); handleClose(); }}>
          <Logout sx={{ mr: 1 }} />
          Sign Out
        </MenuItem>
      </Menu>

      {/* Notifications Popover */}
      <Popover
        open={Boolean(notificationsAnchor)}
        anchorEl={notificationsAnchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 320, maxHeight: 400 } }}
        disableAutoFocus={true}
        disableEnforceFocus={true}
        disableRestoreFocus={true}
      >
        <Box p={2}>
          <Typography variant="h6" gutterBottom>
            Notifications
          </Typography>
        </Box>
        <Divider />
        {notifications.length === 0 ? (
          <Box p={3} textAlign="center">
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 300, overflow: 'auto' }}>
            {notifications.map((notification) => (
              <ListItem key={notification.id} divider>
                <ListItemAvatar>
                  <Avatar sx={{ 
                    bgcolor: notification.read ? 'grey.300' : 'primary.main',
                    width: 32,
                    height: 32,
                  }}>
                    {notification.type === 'success' ? '✓' : 'ℹ'}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={notification.title}
                  secondary={
                    <>
                      <Typography variant="body2" color="text.secondary">
                        {notification.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(notification.createdAt).toLocaleString()}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Popover>
    </AppBar>
  );
};