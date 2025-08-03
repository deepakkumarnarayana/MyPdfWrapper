import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { customTheme } from './theme';
import { useAuth, useBooks, useSessions, useUI } from './store';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { Dashboard } from './components/Dashboard';
import { PdfViewer } from './components/PdfViewer';
import { Box } from '@mui/material';

const App: React.FC = () => {
  const { user, isAuthenticated, checkAuth, fetchNotifications, notifications } = useAuth();
  const { fetchBooks } = useBooks();
  const { fetchSessions } = useSessions();
  const { sidebarCollapsed, toggleSidebar } = useUI();

  // Initialize app
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchBooks();
      fetchSessions();
      fetchNotifications();
    }
  }, [isAuthenticated, fetchBooks, fetchSessions, fetchNotifications]);

  // Dashboard layout component to avoid duplication
  const DashboardLayout: React.FC = () => (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pl: sidebarCollapsed ? `${customTheme.custom.sidebar.collapsedWidth}px` : `${customTheme.custom.sidebar.width}px`,
          transition: customTheme.transitions.create('padding-left'),
        }}
      >
        <Header
          user={user}
          isAuthenticated={isAuthenticated}
          notifications={notifications}
        />
        <Dashboard />
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={customTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          {/* PDF Viewer Route - Full Screen (no sidebar) */}
          <Route path="/pdf/:bookId" element={<PdfViewer />} />
          
          {/* Dashboard routes - With Sidebar Layout */}
          <Route path="/dashboard" element={<DashboardLayout />} />
          <Route path="/" element={<DashboardLayout />} />
          <Route path="*" element={<DashboardLayout />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
};

export default App;