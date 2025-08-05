# Gemini Project Context: PDF Learning Platform

This document provides a comprehensive overview of the "PDF Learning Platform" project to be used as instructional context for AI-driven development.

## 1. Project Overview

This is a full-stack web application designed to help users study and learn from PDF documents. The core feature is the ability to upload PDFs and have an AI (Claude) automatically generate flashcards from the content.

*   **Frontend:** A modern, single-page application built with **React** and **TypeScript**. It uses **Vite** for the build system, **Material-UI** for components, and **Zustand** for state management. All API interactions are centralized through a dedicated `ApiService.ts`.

*   **Backend:** A robust, asynchronous API built with **Python** and **FastAPI**. It uses **SQLAlchemy** as its ORM to connect to a database (SQLite by default). Configuration is managed securely via Pydantic and `.env` files. The backend features a sophisticated AI Proxy for managing requests to external AI providers like Claude and OpenAI, complete with caching, rate limiting, and circuit breaker patterns.

*   **Infrastructure:** The application is fully containerized using **Docker** and orchestrated with **Docker Compose** for easy setup and deployment.

## 2. Building and Running

### With Docker (Recommended)

This is the simplest method to get the entire application running.

```bash
# Build and start all services in the background
docker-compose up --build -d
```

*   **Frontend:** `http://localhost:3000`
*   **Backend API:** `http://localhost:8000`
*   **API Docs:** `http://localhost:8000/docs`

### Local Development (Without Docker)

**Backend:**
```bash
# Navigate to the backend directory
cd src/backend

# Install dependencies
pip install -r requirements.txt

# Run the development server
python main.py
# OR for auto-reloading
uvicorn main:app --reload
```

**Frontend:**
```bash
# Navigate to the frontend directory
cd src/frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

## 3. Development Conventions

### Backend

*   **Configuration:** All configuration is managed in `src/backend/app/config.py` and loaded from `.env` files in the project root (e.g., `.env.development`). **Do not hardcode values.**
*   **Entry Point:** The single entry point for the application is `src/backend/main.py`.
*   **Dependencies:** Managed via `pip` and the `src/backend/requirements.txt` file.
*   **HTTP Services:** All external HTTP calls should be made through the centralized service in `src/backend/app/services/http_service.py`.
*   **Database:** Uses SQLAlchemy ORM. Database models are in `src/backend/app/models.py`.
*   **API Routers:** Endpoints are organized into separate files within `src/backend/app/routers/`.

### Frontend

*   **Dependencies:** Managed via `npm` and the `src/frontend/package.json` file.
*   **API Calls:** All calls to the backend API **must** go through the singleton instance of `apiService` from `src/frontend/src/services/ApiService.ts`. This service handles `axios` configuration, interceptors for auth tokens, and error handling.
*   **Configuration:** The base URL for the API is configured in `src/frontend/src/config/environment.ts` and sourced from Vite environment variables.
*   **Linting:** The project uses ESLint for code quality. Run `npm run lint` to check for issues.
*   **State Management:** Global state is managed with Zustand.
*   **Build System:** Vite is used for development and production builds. The configuration is in `vite.config.ts`.
