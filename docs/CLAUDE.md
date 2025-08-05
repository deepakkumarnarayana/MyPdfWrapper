# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
## Development Principles

### Critical Guidelines for Claude Instances
- **Think First**: Always think and understand before solving issues
- **Ask Questions**: Take time to ask clarifying questions and make informed decisions
- **File Safety**: Be extra careful while deleting files - make sure it's correct to remove them and we have backup plan in case if it fails
- **Design Before Implementation**: Discuss and design before making major changes

### File Operation Safety Rules
1. **Before Deleting**: Always verify the file is safe to remove
2. **Backup Strategy**: Ensure we have recovery options if deletion fails
3. **Double Check**: Confirm file paths and names before any destructive operations
4. **Ask When Uncertain**: If unsure about file deletion, ask for confirmation first

## Development Commands

### Setup and Installation
```bash
# Initial setup - install all dependencies
npm run setup

# Backend only setup
cd src/backend && pip install -r requirements.txt

# Frontend only setup  
cd src/frontend && npm install
```

### Development Servers
```bash
# Start both frontend and backend concurrently
npm run dev

# Start backend only (FastAPI server)
npm run dev:backend
# Alternative: cd src/backend && python main.py

# Start frontend only (React + Vite)
npm run dev:frontend
```

### Testing and Quality
```bash
# Run all tests
npm run test

# Backend tests (pytest)
npm run test:backend
# Alternative: cd src/backend && python -m pytest

# Frontend tests (Vitest)
npm run test:frontend

# Lint frontend code
npm run lint
```

### Production Build
```bash
# Build frontend for production
npm run build

# Production deployment with Docker
npm run docker:prod

# HTTPS setup (interactive)
npm run https:setup
```

### Debug and Development Tools
```bash
# Configuration validation
python scripts/debug/test_config.py

# Database browser (interactive)
python scripts/debug/browse_database.py

# Test different environments
ENV=staging python scripts/debug/test_config.py
ENV=production python scripts/debug/test_config.py

# Service validation
python scripts/debug/validate_services.py
```

## Architecture Overview

### Technology Stack
- **Backend**: FastAPI with async SQLAlchemy, Pydantic Settings, PyMuPDF for PDF processing
- **Frontend**: React 19 + TypeScript, Zustand state management, Material-UI components
- **Database**: SQLite (development) / PostgreSQL (production)
- **AI Integration**: Claude AI API for automated flashcard generation
- **PDF Rendering**: PDF.js with custom optimizations and night mode

### Core Application Flow
1. **PDF Upload** → `src/backend/app/routers/pdfs.py` → `PDFService` processes file
2. **AI Processing** → `FlashcardService` calls Claude API to generate flashcards
3. **Storage** → Files stored via `StorageService` (local/S3), metadata in database
4. **Frontend Rendering** → React components load PDF via PDF.js, display flashcards
5. **Session Tracking** → Study sessions recorded for progress analytics

### Configuration System (Modern Pydantic Settings)
- **Environment Switching**: Change `ENVIRONMENT=development|staging|production` in `.env`
- **File Structure**: `.env` (app constants) + `.env.{environment}` (environment overrides)
- **Security Features**: SecretStr for API keys, comprehensive input validation
- **Centralized Settings**: `src/backend/app/config.py` with `get_settings()` pattern

### Database Architecture
- **Models**: `src/backend/app/models.py` - User, PDF, Flashcard, StudySession, Annotation
- **Migration**: Alembic for schema changes (future implementation)
- **Connection**: Async SQLAlchemy with connection pooling
- **Storage Location**: `data/storage/database.db` (development)

### API Structure
- **Routers**: Organized in `src/backend/app/routers/` by feature
- **Authentication**: JWT-based (auth.py router)
- **Health Checks**: `/health` and `/config/validate` endpoints
- **API Docs**: Available at `/docs` (development only)

### Frontend Architecture
- **State Management**: Zustand stores in `src/frontend/src/store/slices/`
- **Components**: Feature-based organization (`Dashboard/`, `PdfViewer/`)
- **Services**: HTTP client with interceptors, MSW for development mocking
- **PDF Integration**: Custom PDF.js wrapper with performance optimizations

### Security Implementation
- **HTTPS-First**: TLS 1.3 with secure cipher suites
- **Input Validation**: Pydantic validators prevent path traversal, injection
- **Secret Management**: SecretStr pattern, environment variable injection
- **CORS**: Environment-specific origin restrictions
- **Headers**: HSTS, CSP, XSS protection in production

### Storage System
- **PDF Files**: `data/storage/pdfs/` (development) or AWS S3 (production)
- **Database**: `data/storage/database.db` with automatic directory creation
- **Configurations**: Multiple providers (local, S3, Azure) via `StorageService`

## Key Development Patterns

### Configuration Access
```python
# Always use centralized settings
from app.config import get_settings
settings = get_settings()

# Access secrets securely
api_key = settings.claude_api_key.get_secret_value()
```

### Database Operations
```python
# Use dependency injection
from app.database import get_db

async def endpoint(db: AsyncSession = Depends(get_db)):
    # Database operations here
```

### Environment Management
```bash
# Switch environments by editing .env file
ENVIRONMENT=development  # or staging, production

# Test configuration
python scripts/debug/test_config.py
```

### Error Handling
- Frontend: HTTP client with retry logic and error boundaries
- Backend: FastAPI exception handlers with structured logging
- Database: Async operations with proper session management

## Production Deployment

### Environment Preparation
1. Set `ENVIRONMENT=production` in `.env`
2. Configure secrets via environment variables (not files)
3. Setup SSL certificates in `/etc/ssl/` paths
4. Validate configuration: `GET /config/validate`

### Docker Deployment
```bash
# Production containers
docker-compose -f config/docker/production/docker-compose.yml up -d

# Or use npm script
npm run docker:prod
```

### Manual Deployment
```bash
# Backend (Python 3.11+)
cd src/backend
pip install -r requirements.txt
python main.py

# Frontend build
cd src/frontend  
npm run build
# Serve dist/ folder via nginx
```

## Important Notes

### Security Requirements
- Never commit API keys or secrets to git
- Database and `__pycache__` files are git-ignored
- All production endpoints require HTTPS
- Claude API key must be valid for AI features

### Development Workflow
- Database files persist locally in `data/storage/`
- Debug scripts in `scripts/debug/` for troubleshooting
- Frontend uses MSW for API mocking in development
- Hot reload enabled for both frontend and backend

### File Locations
- **Configuration**: `src/backend/app/config.py` (modern Pydantic Settings)
- **Main Backend**: `src/backend/main.py` (FastAPI app with security middleware)
- **Frontend Entry**: `src/frontend/src/main.tsx` (React 19 with StrictMode)
- **Database Models**: `src/backend/app/models.py` (SQLAlchemy async models)
- **Documentation**: `docs/` directory (production deployment, configuration guides)