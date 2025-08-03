# PDF Learning Platform 📚

> AI-powered PDF learning application with automated flashcard generation using Claude AI

## 🚀 Quick Start

### Development Setup
```bash
# Clone the repository
git clone <repository-url>
cd pdf-learning-platform

# Install dependencies
npm run setup

# Start development servers
npm run dev
```

Your application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

### Production Deployment
```bash
# Setup HTTPS (interactive)
./scripts/setup/https-setup.sh

# Or use Docker
docker-compose up -d
```

## 📁 Project Structure

```
pdf-learning-platform/
├── 📚 docs/              # Documentation
├── 🚀 scripts/           # Setup and deployment scripts
├── ⚙️ config/             # Environment configurations
├── 🏗️ src/
│   ├── backend/          # FastAPI application
│   └── frontend/         # React application
├── 🔗 shared/            # Shared types and utilities
├── 🧪 tests/             # Testing framework
├── 🗄️ data/              # Storage and database
├── 🔒 ssl/               # SSL certificates
└── 🔧 tools/             # Development tools
```

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Modern, fast web framework
- **SQLAlchemy** - Database ORM with async support
- **SQLite** - Lightweight database
- **Claude AI** - Automated flashcard generation
- **PyMuPDF** - PDF processing

### Frontend
- **React 19** - Modern UI framework
- **TypeScript** - Type-safe JavaScript
- **Material-UI** - UI component library
- **Zustand** - State management
- **PDF.js** - PDF rendering

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **Let's Encrypt** - Free SSL certificates
- **Nginx** - Reverse proxy (optional)

## 🏃‍♂️ Development

### Available Scripts

```bash
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start frontend only
npm run dev:backend      # Start backend only
npm run build           # Build for production
npm run test            # Run all tests
npm run lint            # Lint code
npm run setup           # Install all dependencies
```

### Environment Variables

Development environment variables are in `config/environments/development.env`:

```env
CLAUDE_API_KEY=your_claude_api_key_here
DATABASE_URL=sqlite+aiosqlite:///./data/storage/database.db
PDF_STORAGE_PATH=./data/storage/pdfs
```

## 🔒 HTTPS Setup

### For Individual Users (Self-Hosted)
```bash
# Interactive setup with domain validation
./scripts/setup/https-setup.sh

# Follow prompts:
# - Enter your domain
# - Enter your email
# - Choose staging/production
```

### For Cloud Deployment
```bash
# AWS/GCP/Azure deployment
./scripts/deployment/deploy-cloud.sh
```

## 🧪 Testing (Future Implementation)

The project structure is ready for comprehensive testing:

```bash
# Unit tests
npm run test:unit

# Integration tests  
npm run test:integration

# End-to-end tests
npm run test:e2e
```

Testing directories are organized in `/tests`:
- `tests/unit/` - Component and function tests
- `tests/integration/` - API and database tests
- `tests/e2e/` - Full user flow tests

## 📚 Features

### Core Features
- 📄 **PDF Upload & Processing** - Support for various PDF formats
- 🤖 **AI-Powered Flashcards** - Automatic generation using Claude AI
- 🎯 **Smart Learning** - Spaced repetition algorithms
- 📊 **Progress Tracking** - Study sessions and performance analytics
- 🌙 **Night Mode** - Dark theme for comfortable reading

### Advanced Features
- 🔍 **PDF Text Selection** - Highlight and annotate
- 💾 **Offline Support** - PWA capabilities (planned)
- 🔐 **Secure by Default** - HTTPS, security headers, CORS protection
- 🐳 **Easy Deployment** - Docker-ready with one-command setup

## 🏗️ Architecture

### Monolith Design
- **Current**: Single FastAPI backend, single React frontend
- **Benefits**: Simple deployment, easy development, unified codebase
- **Future-Ready**: Clean separation allows microservices extraction

### Key Design Principles
- **Individual User Focus** - Optimized for self-hosting
- **Security First** - HTTPS, secure headers, input validation
- **Developer Experience** - Clear structure, good documentation
- **Scalability Ready** - Prepared for future growth

## 🔧 Configuration

### Environment-Based Configuration
- `config/environments/development.env` - Development settings
- `config/environments/production.env` - Production settings
- `config/docker/` - Docker configurations

### Deployment Options
- **Docker Compose** - Single server deployment
- **Cloud Platforms** - AWS, GCP, Azure ready
- **Self-Hosted** - VPS, dedicated servers

## 📖 Documentation

Comprehensive documentation is available in the `/docs` directory:

- **[Getting Started](docs/development/getting-started.md)** - Development setup
- **[API Reference](docs/api/api-reference.md)** - Backend API documentation
- **[Deployment Guide](docs/deployment/self-hosted.md)** - Production deployment
- **[Architecture Overview](docs/development/architecture.md)** - System design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Claude AI** by Anthropic for intelligent flashcard generation
- **PDF.js** by Mozilla for excellent PDF rendering
- **FastAPI** for the amazing Python web framework
- **React** team for the powerful UI library

## 📞 Support

- 📖 **Documentation**: Check the `/docs` directory
- 🐛 **Issues**: Report bugs and feature requests on GitHub
- 💬 **Discussions**: Community discussions and Q&A

---

**PDF Learning Platform** - Transform your PDFs into interactive learning experiences! 🎓