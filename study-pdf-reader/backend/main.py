from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
from pathlib import Path
from dotenv import load_dotenv

from app.database import create_tables
from app.routers import pdfs, flashcards, health, books

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_tables()
    yield
    # Shutdown
    pass

app = FastAPI(
    title="Study PDF Reader API",
    description="AI-powered PDF learning application with automated flashcard generation",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/api")
app.include_router(pdfs.router, prefix="/api")
app.include_router(flashcards.router, prefix="/api")
app.include_router(books.router, prefix="/api/books", tags=["books"])

# Serve static files (PDFs)
project_root = Path(__file__).parent.parent
default_pdf_storage = project_root / "storage" / "pdfs"
pdf_storage_path = os.getenv("PDF_STORAGE_PATH", str(default_pdf_storage))

# Ensure PDF storage directory exists
os.makedirs(pdf_storage_path, exist_ok=True)

if os.path.exists(pdf_storage_path):
    app.mount("/static", StaticFiles(directory=pdf_storage_path), name="static")

@app.get("/")
async def root():
    return {"message": "Study PDF Reader API is running"}

@app.get("/debug/storage")
async def debug_storage():
    """Debug endpoint to check storage configuration"""
    project_root = Path(__file__).parent.parent
    pdf_storage = project_root / "storage" / "pdfs"
    
    # List files in storage
    files = []
    if pdf_storage.exists():
        files = [f.name for f in pdf_storage.iterdir() if f.is_file()]
    
    return {
        "pdf_storage_path": str(pdf_storage),
        "storage_exists": pdf_storage.exists(),
        "files_in_storage": files,
        "total_files": len(files)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)