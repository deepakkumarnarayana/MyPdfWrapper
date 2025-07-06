# Study PDF Reader

An AI-powered PDF learning application that transforms passive reading into active learning through automated flashcard generation using Claude AI.

## Features

- 📚 **PDF Upload & Viewing**: Upload and view PDF documents with zoom and navigation controls
- 🤖 **AI-Powered Flashcards**: Automatically generate flashcards from PDF content using Claude AI
- 🧠 **Study Mode**: Interactive flashcard study sessions with progress tracking
- 💾 **Smart Storage**: Organized storage system for PDFs and study data
- 🎨 **Modern UI**: Clean, responsive interface built with React 19 and Tailwind CSS
- ⚡ **Fast Performance**: Built with Vite and optimized for speed

## Technology Stack

### Frontend
- **React 19.1.0** - Latest React with new features
- **TypeScript 5.8.3** - Type safety and developer experience
- **Vite 7.0.2** - Lightning-fast build tool
- **Tailwind CSS 4.1.11** - Utility-first CSS framework
- **Zustand 5.0.6** - Lightweight state management
- **PDF.js 4.0.379** - PDF rendering in the browser
- **Axios 1.10.0** - HTTP client for API calls

### Backend
- **FastAPI 0.115.6** - Modern Python web framework
- **SQLAlchemy 2.0.41** - SQL toolkit and ORM
- **SQLite** - Lightweight database for development
- **PyMuPDF 1.26.3** - PDF processing and text extraction
- **Anthropic 0.39.0** - Claude AI integration
- **Uvicorn 0.32.1** - ASGI server

### Development Tools
- **Vitest** - Unit testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Static type checking

## Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Python** 3.9 or higher
- **Claude API Key** from Anthropic

### Installation

1. **Clone or create the project directory:**
   ```bash
   # If you have the complete project structure
   cd study-pdf-reader
   
   # Or create the directory structure as provided
   ```

2. **Set up the project (includes virtual environment):**
   ```bash
   npm run setup
   ```
   
   **For Windows users:**
   ```bash
   npm run setup:frontend
   npm run setup:backend:windows
   ```

3. **Alternative: Manual setup with virtual environment:**
   
   **Frontend:**
   ```bash
   npm install
   ```
   
   **Backend (Linux/macOS):**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```
   
   **Backend (Windows):**
   ```bash
   cd backend
   python -m venv venv
   venv\Scripts\activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Set up environment variables:**
   
   **Backend (.env):**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Claude API key:
   ```env
   CLAUDE_API_KEY=your_claude_api_key_here
   PDF_STORAGE_PATH=./storage/pdfs
   DATABASE_URL=sqlite+aiosqlite:///./storage/database.db
   ```
   
   **Frontend (.env):**
   ```bash
   cd frontend
   cp .env.example .env
   ```

5. **Start the development servers:**
   ```bash
   npm run dev
   ```
   
   **For Windows users:**
   ```bash
   npm run dev:frontend
   npm run dev:backend:windows
   ```

This will start:
- Frontend at http://localhost:3000
- Backend at http://localhost:8000

## Development Commands

### Root Level Commands
- `npm run install-all` - Install all dependencies (frontend + backend)
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build the frontend for production
- `npm run test` - Run frontend tests
- `npm run test:backend` - Run backend tests
- `npm run lint` - Lint frontend code
- `npm run lint:backend` - Lint backend code
- `npm run clean` - Clean all build artifacts and caches

### Frontend Commands (in /frontend)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests with Vitest
- `npm run test:ui` - Run tests with UI
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Lint code with ESLint
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking

### Backend Commands (in /backend)
- `uvicorn main:app --reload` - Start development server
- `pytest` - Run tests
- `ruff check .` - Lint code
- `black .` - Format code
- `mypy .` - Type checking

## Project Structure

```
study-pdf-reader/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── stores/          # Zustand state management
│   │   ├── services/        # API services
│   │   ├── types/           # TypeScript type definitions
│   │   ├── hooks/           # Custom React hooks
│   │   └── utils/           # Utility functions
│   ├── public/              # Static assets
│   └── package.json         # Frontend dependencies
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── routers/         # API route handlers
│   │   ├── services/        # Business logic services
│   │   ├── models.py        # Database models
│   │   ├── schemas.py       # Pydantic schemas
│   │   └── database.py      # Database configuration
│   ├── tests/               # Backend tests
│   └── main.py              # FastAPI application
├── storage/                 # Data storage
│   ├── pdfs/               # Uploaded PDF files
│   └── database/           # SQLite database
├── requirements.txt         # Python dependencies
├── package.json            # Root package.json with scripts
└── README.md               # This file
```

## API Endpoints

### Health Check
- `GET /api/health` - Basic health check
- `GET /api/health/detailed` - Detailed system health

### PDF Management
- `GET /api/pdfs` - List all PDFs
- `POST /api/pdfs` - Upload a PDF
- `GET /api/pdfs/{pdf_id}` - Get PDF details
- `DELETE /api/pdfs/{pdf_id}` - Delete a PDF

### Flashcards
- `GET /api/pdfs/{pdf_id}/flashcards` - Get flashcards for a PDF
- `POST /api/pdfs/{pdf_id}/flashcards/generate` - Generate flashcards
- `PUT /api/flashcards/{flashcard_id}` - Update a flashcard
- `DELETE /api/flashcards/{flashcard_id}` - Delete a flashcard

## Usage

1. **Upload a PDF**: Drag and drop or click to upload a PDF file
2. **View PDF**: Click on a PDF in the sidebar to view it
3. **Generate Flashcards**: Click "Generate Flashcards" to create AI-powered study cards
4. **Study Mode**: Enter study mode to review flashcards interactively
5. **Track Progress**: Monitor your study progress and flashcard performance

## Configuration

### Environment Variables

**Backend (.env):**
- `CLAUDE_API_KEY` - Your Anthropic Claude API key (required)
- `PDF_STORAGE_PATH` - Directory for PDF storage (default: ./storage/pdfs)
- `DATABASE_URL` - Database connection string (default: SQLite)
- `MAX_FILE_SIZE` - Maximum PDF file size in bytes (default: 10MB)
- `MAX_FLASHCARDS_PER_GENERATION` - Maximum flashcards per generation (default: 10)

**Frontend (.env):**
- `VITE_API_BASE_URL` - Backend API URL (default: http://localhost:8000/api)
- `VITE_DEBUG` - Enable debug mode (default: true in development)

## Testing

### Frontend Tests
```bash
cd frontend
npm run test          # Run tests
npm run test:ui       # Run tests with UI
npm run test:coverage # Run tests with coverage
```

### Backend Tests
```bash
cd backend
pytest                # Run all tests
pytest tests/         # Run specific test directory
pytest -v             # Verbose output
```

## Deployment

### Frontend Production Build
```bash
cd frontend
npm run build
```

### Backend Production
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Troubleshooting

### Common Issues

1. **PDF not loading**: Check that the PDF file is valid and not corrupted
2. **Flashcards not generating**: Ensure Claude API key is set correctly
3. **CORS errors**: Verify frontend and backend URLs in configuration
4. **Database errors**: Check that storage directory exists and has write permissions

### Getting Help

- Check the browser console for frontend errors
- Check the backend logs for API errors
- Verify all environment variables are set correctly
- Ensure all dependencies are installed correctly

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- [Anthropic](https://anthropic.com) for Claude AI
- [PDF.js](https://mozilla.github.io/pdf.js/) for PDF rendering
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://react.dev/) for the frontend framework