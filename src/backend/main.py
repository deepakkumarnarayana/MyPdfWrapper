from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import time
from pathlib import Path

from app.database import create_tables
from app.routers import pdfs, flashcards, health, sessions, auth, system, ai_providers

# Import modern settings configuration
from app.config import get_settings

# Get settings instance
settings = get_settings()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await create_tables()
    yield
    # Shutdown
    pass

app = FastAPI(
    title=settings.app_name,
    description="AI-powered PDF learning application with automated flashcard generation",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None
)

# Configure CORS using settings
allowed_origins = settings.allowed_origins_list.copy()

# Add production domain if specified
if settings.domain:
    allowed_origins.extend([
        f"https://{settings.domain}",
        f"https://www.{settings.domain}"
    ])

# Security middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    
    # Security headers
    if settings.environment == "production":
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
if settings.environment == "production" and settings.domain:
    allowed_hosts = [settings.domain, f"www.{settings.domain}"]
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=allowed_hosts
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

# Serve static files (PDFs) - Use modern settings
pdf_storage_path = settings.actual_pdf_storage_path
print(f"📁 PDF storage path: {pdf_storage_path}")

# Directory already created by settings, just mount it
if os.path.exists(pdf_storage_path):
    app.mount("/static", StaticFiles(directory=pdf_storage_path), name="static")
    print(f"✅ Static files mounted from: {pdf_storage_path}")
else:
    print(f"⚠️  Warning: PDF storage directory does not exist: {pdf_storage_path}")

@app.get("/")
async def root():
    return {"message": "Study PDF Reader API is running"}

@app.get("/debug/storage")
async def debug_storage():
    """Debug endpoint to check storage configuration - Development only"""
    if settings.environment == "production":
        raise HTTPException(status_code=404, detail="Not found")
    
    # Use modern settings configuration
    pdf_storage_path = Path(settings.actual_pdf_storage_path)
    
    # List files in storage (basic info only)
    file_count = 0
    if pdf_storage_path.exists():
        file_count = len([f for f in pdf_storage_path.iterdir() if f.is_file()])
    
    return {
        "project_root": str(settings.project_root),
        "storage_directory": str(settings.storage_dir),
        "pdf_storage_path": str(settings.actual_pdf_storage_path),
        "database_url": settings.actual_database_url,
        "storage_exists": pdf_storage_path.exists(),
        "total_files": file_count,
        "environment": settings.environment
    }

@app.get("/config/validate")
async def validate_configuration():
    """Validate configuration for production readiness"""
    if settings.environment == "production":
        raise HTTPException(status_code=404, detail="Not found")
    
    validation_results = settings.validate_configuration()
    
    overall_status = "healthy" if all(validation_results.values()) else "issues_detected"
    
    return {
        "status": overall_status,
        "environment": settings.environment,
        "validation_results": validation_results,
        "recommendations": _get_configuration_recommendations(validation_results)
    }

def _get_configuration_recommendations(validation_results: dict[str, bool]) -> list[str]:
    """Generate recommendations based on validation results"""
    recommendations = []
    
    if not validation_results.get("api_keys_configured"):
        recommendations.append("Configure valid Claude API key for AI functionality")
    
    if not validation_results.get("storage_accessible"):
        recommendations.append("Ensure PDF storage directory is writable")
    
    if not validation_results.get("database_reachable"):
        recommendations.append("Verify database connectivity and permissions")
    
    if not validation_results.get("security_headers_enabled"):
        recommendations.append("Enable security headers for production deployment")
    
    if not validation_results.get("ssl_configured"):
        recommendations.append("Configure SSL certificates for HTTPS")
    
    if not recommendations:
        recommendations.append("Configuration appears healthy")
    
    return recommendations

if __name__ == "__main__":
    import uvicorn
    import ssl
    
    # Check for SSL certificate files using centralized settings
    if (settings.ssl_cert_path and settings.ssl_key_path and 
        os.path.exists(settings.ssl_cert_path) and os.path.exists(settings.ssl_key_path)):
        # Production HTTPS mode
        print(f"🔒 Starting server with HTTPS on port 443")
        print(f"   Domain: {settings.domain or 'localhost'}")
        print(f"   Environment: {settings.environment}")
        
        # Production-hardened SSL configuration (2024 standards)
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ssl_context.load_cert_chain(settings.ssl_cert_path, settings.ssl_key_path)
        
        # Security hardening - TLS 1.3 preferred, TLS 1.2 minimum
        ssl_context.minimum_version = ssl.TLSVersion.TLSv1_2
        ssl_context.maximum_version = ssl.TLSVersion.TLSv1_3
        
        # Use only secure cipher suites (OWASP recommended 2024)
        ssl_context.set_ciphers(
            "ECDHE-ECDSA-AES256-GCM-SHA384:"
            "ECDHE-RSA-AES256-GCM-SHA384:"
            "ECDHE-ECDSA-CHACHA20-POLY1305:"
            "ECDHE-RSA-CHACHA20-POLY1305:"
            "ECDHE-ECDSA-AES128-GCM-SHA256:"
            "ECDHE-RSA-AES128-GCM-SHA256"
        )
        
        # Additional security options
        ssl_context.options |= ssl.OP_NO_SSLv2 | ssl.OP_NO_SSLv3 | ssl.OP_NO_TLSv1 | ssl.OP_NO_TLSv1_1
        ssl_context.options |= ssl.OP_CIPHER_SERVER_PREFERENCE
        ssl_context.options |= ssl.OP_SINGLE_DH_USE | ssl.OP_SINGLE_ECDH_USE
        ssl_context.options |= ssl.OP_NO_COMPRESSION  # Prevent CRIME attacks
        ssl_context.options |= ssl.OP_NO_RENEGOTIATION  # Prevent renegotiation attacks
        
        # Production server configuration
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=443,
            ssl=ssl_context,
            access_log=settings.enable_access_logs,
            server_header=False,
            date_header=False
        )
    else:
        # Development HTTP mode
        print("🌐 Starting server with HTTP on port 8000")
        uvicorn.run(app, host="0.0.0.0", port=8000)