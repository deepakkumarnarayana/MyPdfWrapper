from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import time
from pathlib import Path
from dotenv import load_dotenv

from app.database import create_tables
from app.routers import pdfs, flashcards, health, sessions, auth, system, ai_providers

# Load environment variables from development config first
load_dotenv(Path(__file__).parent.parent.parent / "config" / "environments" / "development.env")
load_dotenv()  # Also load any local .env files

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
    lifespan=lifespan,
    docs_url="/docs" if os.getenv("ENVIRONMENT") != "production" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT") != "production" else None
)

# Configure CORS with enhanced security
allowed_origins = []

# Development origins (only in non-production)
if os.getenv("ENVIRONMENT") != "production":
    allowed_origins.extend([
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "https://localhost:3000",
        "https://127.0.0.1:3000"
    ])

# Production domain if specified
domain = os.getenv("DOMAIN")
if domain:
    allowed_origins.extend([
        f"https://{domain}",
        f"https://www.{domain}"
    ])

# Additional allowed origins from environment
additional_origins = os.getenv("ALLOWED_ORIGINS", "").split(",")
allowed_origins.extend([origin.strip() for origin in additional_origins if origin.strip()])

# Security middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    # Security headers
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none';"
    
    # Performance headers
    response.headers["X-Process-Time"] = str(process_time)
    
    return response

# Trusted host middleware for production
if os.getenv("ENVIRONMENT") == "production":
    allowed_hosts = [os.getenv("DOMAIN")]
    if os.getenv("ALLOWED_HOSTS"):
        allowed_hosts.extend(os.getenv("ALLOWED_HOSTS").split(","))
    
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=[host.strip() for host in allowed_hosts if host and host.strip()]
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],  # Specific methods only
    allow_headers=["Content-Type", "Authorization", "X-Requested-With", "Accept"],
)

# Include routers with versioning
app.include_router(health.router, prefix="/api/v1")
app.include_router(pdfs.router, prefix="/api/v1", tags=["documents"])
app.include_router(flashcards.router, prefix="/api/v1")
app.include_router(sessions.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(system.router, prefix="/api/v1")
app.include_router(ai_providers.router, prefix="/api/v1")

# Serve static files (PDFs) - Updated for new structure
project_root = Path(__file__).parent.parent.parent  # Go up to project root
default_pdf_storage = project_root / "data" / "storage" / "pdfs"
pdf_storage_path = os.getenv("PDF_STORAGE_PATH", str(default_pdf_storage))
print(f"PDF storage path: {pdf_storage_path}")
# Ensure PDF storage directory exists
os.makedirs(pdf_storage_path, exist_ok=True)

if os.path.exists(pdf_storage_path):
    app.mount("/static", StaticFiles(directory=pdf_storage_path), name="static")

@app.get("/")
async def root():
    return {"message": "Study PDF Reader API is running"}

@app.get("/debug/storage")
async def debug_storage():
    """Debug endpoint to check storage configuration - Development only"""
    if os.getenv("ENVIRONMENT") == "production":
        raise HTTPException(status_code=404, detail="Not found")
    
    project_root = Path(__file__).parent.parent.parent  # Go up to project root
    pdf_storage = project_root / "data" / "storage" / "pdfs"
    
    # List files in storage (basic info only)
    file_count = 0
    if pdf_storage.exists():
        file_count = len([f for f in pdf_storage.iterdir() if f.is_file()])
    
    return {
        "pdf_storage_path": str(pdf_storage),
        "storage_exists": pdf_storage.exists(),
        "total_files": file_count
    }

if __name__ == "__main__":
    import uvicorn
    import ssl
    
    # Check for SSL certificate files
    ssl_cert_path = os.getenv("SSL_CERT_PATH")
    ssl_key_path = os.getenv("SSL_KEY_PATH")
    
    if ssl_cert_path and ssl_key_path and os.path.exists(ssl_cert_path) and os.path.exists(ssl_key_path):
        # Production HTTPS mode
        print(f"🔒 Starting server with HTTPS on port 443")
        print(f"   Domain: {os.getenv('DOMAIN', 'localhost')}")
        print(f"   Environment: {os.getenv('ENVIRONMENT', 'development')}")
        
        # Enhanced SSL configuration
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain(ssl_cert_path, ssl_key_path)
        
        # Security hardening
        ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
        ssl_context.set_ciphers("ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS:!3DES")
        ssl_context.options |= ssl.OP_NO_SSLv2 | ssl.OP_NO_SSLv3 | ssl.OP_NO_TLSv1 | ssl.OP_NO_TLSv1_1
        ssl_context.options |= ssl.OP_CIPHER_SERVER_PREFERENCE
        ssl_context.options |= ssl.OP_SINGLE_DH_USE | ssl.OP_SINGLE_ECDH_USE
        
        # Production server configuration
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=443,
            ssl=ssl_context,
            access_log=os.getenv("ENABLE_ACCESS_LOGS", "true").lower() == "true",
            server_header=False,
            date_header=False
        )
    else:
        # Development HTTP mode
        print("🌐 Starting server with HTTP on port 8000")
        uvicorn.run(app, host="0.0.0.0", port=8000)