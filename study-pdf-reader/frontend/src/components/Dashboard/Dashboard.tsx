import React from 'react';
import { Box, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store';
import { useDashboardData } from './hooks/useDashboardData';
import { booksApi } from '../../services/api/books.api';
import { researchPapersApi } from '../../services/api/researchPapers.api';
import { sessionsApi } from '../../services/api/sessions.api';
import { aiProvidersApi } from '../../services/api/aiProviders.api';
import { systemApi } from '../../services/api/system.api';
// Sections
import {
  WelcomeSection,
  StatsSection,
  BooksSection,
  SessionsSection,
  ResearchPapersSection,
  AIProvidersSection,
  QuickStartSection,
  SystemStatusSection,
} from './sections';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    books,
    researchPapers,
    sessions,
    aiProviders,
    systemServices,
    stats,
    isLoading,
    error,
    refreshData,
    reloadBooks,
    reloadSessions,
  } = useDashboardData();

  return (
    <Box sx={{ p: 3 }}>
      {/* Welcome Section */}
      <WelcomeSection user={user} />

      <Grid container spacing={3}>
        {/* Statistics Cards */}
        <Grid item xs={12}>
          <StatsSection 
            stats={stats} 
            isLoading={isLoading}
            error={error}
            onRefresh={refreshData}
          />
        </Grid>

        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <BooksSection 
            books={books}
            isLoading={isLoading}
            error={error}
            onBookSelect={(bookId) => {
              const selectedBook = books.find(book => book.id === bookId);
              if (selectedBook) {
                // Navigate to PDF viewer page
                navigate(`/pdf/${bookId}`);
              }
            }}
            onUpload={async (file) => {
              try {
                await booksApi.uploadBook(file);
                reloadBooks();
              } catch (error) {
                // TODO: Show error notification to user
              }
            }}
            onRefresh={reloadBooks}
          />
          <SessionsSection 
            sessions={sessions}
            isLoading={isLoading}
            error={error}
            onSessionView={(_sessionId) => {
              // TODO: Navigate to session view
            }}
            onExportToAnki={async (sessionId) => {
              try {
                await sessionsApi.exportSessionToAnki(sessionId);
                // TODO: Show success message
              } catch (error) {
                // TODO: Show error notification to user
              }
            }}
            onRefresh={reloadSessions}
          />
        </Grid>

        {/* Right Sidebar */}
        <Grid item xs={12} md={4}>
          <ResearchPapersSection 
            papers={researchPapers}
            isLoading={isLoading}
            error={error}
            onPaperSelect={(paperId) => {
              // Navigate to PDF viewer for research papers
              navigate(`/pdf/${paperId}`);
            }}
            onUpload={async (file) => {
              try {
                await researchPapersApi.uploadResearchPaper(file);
                refreshData();
              } catch (error) {
                // TODO: Show error notification to user
              }
            }}
            onRefresh={refreshData}
          />
          <AIProvidersSection 
            providers={aiProviders}
            isLoading={isLoading}
            error={error}
            onProviderSelect={async (providerId) => {
              try {
                await aiProvidersApi.selectAIProvider(providerId);
                refreshData();
              } catch (error) {
                // TODO: Show error notification to user
              }
            }}
            onRefresh={refreshData}
          />
          <QuickStartSection 
            onStartSession={async () => {
              try {
                await systemApi.startLearningSession();
                // TODO: Navigate to learning session
              } catch (error) {
                // TODO: Show error notification to user
              }
            }}
          />
          <SystemStatusSection 
            services={systemServices}
            isLoading={isLoading}
            error={error}
            onRefresh={refreshData}
          />
        </Grid>
      </Grid>
    </Box>
  );
};