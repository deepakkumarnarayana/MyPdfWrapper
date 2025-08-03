# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an AI-powered PDF learning application that transforms passive reading into active learning through automated flashcard generation using Claude AI. The application consists of a FastAPI backend with SQLite database and a React frontend using TypeScript, Zustand for state management, and PDF.js for PDF rendering.

## Development Commands

### Setup
```bash
# Set up entire project (recommended)
npm run setup

# Windows users
npm run setup:frontend
npm run setup:backend:windows

# Manual setup
npm install                                    # Install root dependencies
cd frontend && npm install                     # Install frontend dependencies
cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt  # Backend setup
```

### Development
```bash
npm run dev                                    # Start both frontend and backend
npm run dev:frontend                           # Start frontend only (port 3000)
npm run dev:backend                            # Start backend only (port 8000)
npm run dev:backend:windows                    # Start backend on Windows
```

### Testing
```bash
npm run test                                   # Run frontend tests (Vitest)
npm run test:backend                           # Run backend tests (pytest)
npm run test:backend:windows                   # Run backend tests on Windows
cd frontend && npm run test:ui                 # Run frontend tests with UI
cd frontend && npm run test:coverage           # Run frontend tests with coverage
```

### Linting and Formatting
```bash
npm run lint                                   # Lint frontend (ESLint)
npm run lint:backend                           # Lint backend (ruff + black)
npm run format                                 # Format frontend (Prettier)
npm run format:backend                         # Format backend (ruff + black)
cd frontend && npm run typecheck               # TypeScript type checking
```

### Build
```bash
npm run build                                  # Build frontend for production
```

### HTTPS Setup (Production)
```bash
# Quick HTTPS setup with Let's Encrypt
./setup-https.sh                               # Interactive setup script

# Manual start with HTTPS
./start-https.sh                               # Start with SSL certificates

# SSL management
./renew-ssl.sh                                 # Manual certificate renewal
tail -f ssl-renewal.log                        # View renewal logs
```

## Architecture

### Backend (FastAPI)
- **FastAPI** with async/await patterns
- **SQLAlchemy 2.0** with async support using aiosqlite
- **Database models**: PDF, Flashcard, Annotation, StudySession
- **Services layer**: PDF processing with PyMuPDF, AI integration with Anthropic Claude
- **Routers**: RESTful API endpoints for PDFs, flashcards, and health checks
- **File storage**: PDFs stored in `storage/pdfs/` directory

### Frontend (React 19 + TypeScript + Material-UI)
- **React 19** with latest features
- **Material-UI (MUI)** for modern, accessible UI components
- **Zustand** for state management (single store pattern)
- **PDF.js** for PDF rendering and viewing with text selection
- **Axios** for API communication
- **Vitest** for testing with React Testing Library

### Database Schema
- **pdfs**: Core PDF metadata with relationships to flashcards and annotations
- **flashcards**: AI-generated study cards with spaced repetition tracking
- **annotations**: PDF highlights, notes, and bookmarks
- **study_sessions**: Study progress and performance tracking

## Key Files and Patterns

### Backend Entry Point
- `backend/main.py` - FastAPI app with CORS, static file serving, and router inclusion
- Database tables auto-created on startup via lifespan events

### State Management
- `frontend/src/stores/pdfStore.ts` - Zustand store handling PDF state, flashcard generation, and error management
- Single store pattern with async actions

### API Service Layer
- `frontend/src/services/pdfService.ts` - Axios-based API client
- `backend/app/services/` - Business logic for PDF processing and AI integration

### Database Integration
- `backend/app/database.py` - SQLAlchemy async engine configuration
- `backend/app/models.py` - Database models with relationships

### PDF Viewer Implementation
- `frontend/src/components/PDFViewer.tsx` - Enhanced Material-UI PDF viewer with text selection
- Uses PDF.js with both canvas rendering and text layer overlay
- Progressive page loading to prevent canvas conflicts and improve performance
- Material-UI components for modern, accessible interface
- Text selection enabled through PDF.js TextLayer API
- Enhanced UI with AppBar, Cards, IconButtons, and Tooltips

## Environment Configuration

### Backend (.env)
```env
CLAUDE_API_KEY=your_claude_api_key_here
PDF_STORAGE_PATH=./storage/pdfs
DATABASE_URL=sqlite+aiosqlite:///./storage/database.db
MAX_FILE_SIZE=10485760
MAX_FLASHCARDS_PER_GENERATION=10

# HTTPS Configuration (Production)
SSL_CERT_PATH=/path/to/ssl/cert.pem
SSL_KEY_PATH=/path/to/ssl/private.key
DOMAIN=yourdomain.com
```

### Frontend (.env)
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_DEBUG=true
```

## Development Workflow

1. **Backend virtual environment** must be activated for backend development
2. **PDF storage** directory (`storage/pdfs/`) is auto-created
3. **Database** is SQLite with automatic table creation
4. **AI integration** requires valid Claude API key
5. **CORS** is configured for localhost:3000 frontend

## Common Issues

- **Virtual environment**: Backend requires activated venv for all operations
- **PDF rendering**: Uses PDF.js with worker configuration in Vite
- **File uploads**: Handled via multipart form data with size limits
- **Database migrations**: Uses Alembic for schema changes (if implemented)
- **AI generation**: Claude API calls have timeout and rate limiting considerations