import React, { useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material';
import { customTheme } from './theme';
import { useAuth, useUI } from './store';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
// Lazy load the main components
const Dashboard = React.lazy(() => import('./components/Dashboard').then(module => ({ default: module.Dashboard })));
const PdfViewer = React.lazy(() => import('./components/PdfViewer').then(module => ({ default: module.PdfViewer })));

const App: React.FC = () => {
  const { user, isAuthenticated, checkAuth, fetchNotifications, notifications } = useAuth();
  const { sidebarCollapsed, toggleSidebar } = useUI();

  // Initialize app auth state
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Fetch user-specific data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
    }
  }, [isAuthenticated, fetchNotifications]);

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

  // A simple loading spinner for Suspense fallback
  const LoadingSpinner = () => (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <CircularProgress />
    </Box>
  );

  return (
    <ThemeProvider theme={customTheme}>
      <CssBaseline />
      <Router>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* PDF Viewer Route - Full Screen (no sidebar) */}
            <Route path="/pdf/:bookId" element={<PdfViewer />} />
            
            {/* Dashboard routes - With Sidebar Layout */}
            <Route path="/dashboard" element={<DashboardLayout />} />
            <Route path="/" element={<DashboardLayout />} />
            <Route path="*" element={<DashboardLayout />} />
          </Routes>
        </Suspense>
      </Router>
    </ThemeProvider>
  );
};

export default App;