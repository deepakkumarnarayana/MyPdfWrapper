"""
Enhanced FastAPI Main Application with AI Proxy Integration
Production-ready application setup with comprehensive middleware, monitoring, and error handling.
"""

import asyncio
import signal
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.sessions import SessionMiddleware
import uvicorn

# Add the app directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

from app.config import get_settings
from app.database import create_tables
from app.services.redis_manager import initialize_redis, shutdown_redis
from app.services.logging_service import get_logger, LoggingContext, initialize_logging
from app.services.error_handler import error_handler
from app.middleware.ai_proxy_middleware import AIProxyRateLimitMiddleware, AIProxySecurityMiddleware

# Import routers
from app.routers import (
    health, pdfs, sessions, flashcards, auth, system,
    ai_providers  # Enhanced AI proxy router
)

# Initialize logging first
initialize_logging()
logger = get_logger("ai_proxy.main")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown"""
    logger.info("Starting AI Proxy application...")
    
    try:
        # Create database tables
        await create_tables()
        logger.info("Database tables initialized")
        
        # Initialize Redis
        await initialize_redis()
        
        # Run database migration for AI proxy tables
        try:
            from migrate_ai_proxy_database import AIProxyDatabaseMigrator
            migrator = AIProxyDatabaseMigrator()
            migration_success = await migrator.run_migration()
            if migration_success:
                logger.info("AI Proxy database migration completed successfully")
            else:
                logger.warning("AI Proxy database migration failed - some features may not work")
        except Exception as e:
            logger.warning(f"AI Proxy database migration error: {e}")
        
        # Validate configuration
        config_validation = settings.validate_configuration()
        if not all(config_validation.values()):
            logger.warning(f"Configuration validation issues: {config_validation}")
        
        logger.info("Application startup completed successfully")
        yield
        
    except Exception as e:
        logger.error(f"Application startup failed: {e}")
        raise
    
    finally:
        # Shutdown procedures
        logger.info("Shutting down AI Proxy application...")
        
        try:
            await shutdown_redis()
            logger.info("Redis connections closed")
        except Exception as e:
            logger.error(f"Error during Redis shutdown: {e}")
        
        logger.info("Application shutdown completed")


def create_application() -> FastAPI:
    """Create and configure the FastAPI application"""
    
    # Create FastAPI app with lifespan management
    app = FastAPI(
        title=settings.app_name,
        description="PDF Learning Platform with AI Proxy - Secure, scalable AI API gateway",
        version="2.0.0",
        docs_url="/docs" if settings.debug else None,
        redoc_url="/redoc" if settings.debug else None,
        lifespan=lifespan
    )
    
    # Add middleware in correct order (last added = first executed)
    
    # 1. Gzip compression (outermost)
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    
    # 2. Trusted Host middleware (security)
    if settings.environment == "production":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.allowed_hosts_list
        )
    
    # 3. CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-RateLimit-*", "X-Security-*", "X-Request-ID"]
    )
    
    # 4. Session middleware
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.claude_api_key.get_secret_value()[:32],  # Use part of API key as secret
        max_age=settings.session_timeout_minutes * 60,
        same_site="lax",
        https_only=settings.secure_cookies
    )
    
    # 5. AI Proxy specific middleware
    app.add_middleware(AIProxySecurityMiddleware)
    app.add_middleware(AIProxyRateLimitMiddleware)
    
    # Add global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Global exception handler with structured error responses"""
        
        # Use the comprehensive error handler
        try:
            return await error_handler.handle_exception(
                exc, 
                request,
                path=str(request.url.path),
                method=request.method
            )
        except Exception as handler_error:
            logger.error(f"Error handler failed: {handler_error}")
            
            # Fallback error response
            return JSONResponse(
                status_code=500,
                content={
                    "error": True,
                    "error_code": "HANDLER_ERROR",
                    "message": "An unexpected error occurred",
                    "timestamp": "2025-01-20T10:00:00Z"
                }
            )
    
    # Add request logging middleware
    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        """Log all requests with timing and context"""
        
        import time
        import uuid
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Extract client info
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        
        start_time = time.time()
        
        # Set up logging context
        with LoggingContext(request_id=request_id):
            
            # Log request start
            logger.info(
                f"Request started: {request.method} {request.url.path}",
                method=request.method,
                path=str(request.url.path),
                client_ip=client_ip,
                user_agent=user_agent[:100],  # Truncate long user agents
                request_size=request.headers.get("content-length")
            )
            
            try:
                # Process request
                response = await call_next(request)
                
                # Calculate duration
                duration_ms = int((time.time() - start_time) * 1000)
                
                # Log request completion
                logger.info(
                    f"Request completed: {request.method} {request.url.path} - {response.status_code} in {duration_ms}ms",
                    method=request.method,
                    path=str(request.url.path),
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                    response_size=response.headers.get("content-length")
                )
                
                # Add request ID to response
                response.headers["X-Request-ID"] = request_id
                
                return response
                
            except Exception as e:
                duration_ms = int((time.time() - start_time) * 1000)
                
                logger.error(
                    f"Request failed: {request.method} {request.url.path} in {duration_ms}ms",
                    method=request.method,
                    path=str(request.url.path),
                    duration_ms=duration_ms,
                    error=str(e)
                )
                
                raise
    
    # Health check endpoints (before authentication)
    @app.get("/")
    async def root():
        """Root endpoint providing a simple welcome message."""
        return {"message": f"Welcome to {settings.app_name}"}

    @app.get("/health")
    async def health_check():
        """Basic health check endpoint"""
        return {
            "status": "healthy",
            "service": "ai-proxy",
            "version": "2.0.0",
            "timestamp": "2025-01-20T10:00:00Z"
        }
    
    @app.get("/health/detailed")
    async def detailed_health_check():
        """Detailed health check with component status"""
        from app.services.redis_manager import get_redis_manager
        
        health_status = {
            "status": "healthy",
            "service": "ai-proxy",
            "version": "2.0.0",
            "timestamp": "2025-01-20T10:00:00Z",
            "components": {}
        }
        
        try:
            # Check Redis
            redis_manager = await get_redis_manager()
            redis_info = await redis_manager.get_connection_info()
            health_status["components"]["redis"] = {
                "status": "healthy" if redis_info["connected"] else "unhealthy",
                "details": redis_info
            }
        except Exception as e:
            health_status["components"]["redis"] = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        # Check database
        try:
            from app.database import get_db
            async for db in get_db():
                await db.execute("SELECT 1")
                health_status["components"]["database"] = {"status": "healthy"}
                break
        except Exception as e:
            health_status["components"]["database"] = {
                "status": "unhealthy",
                "error": str(e)
            }
        
        # Check AI providers
        try:
            claude_key = settings.claude_api_key.get_secret_value()
            openai_key = settings.openai_api_key.get_secret_value()
            
            health_status["components"]["ai_providers"] = {
                "claude": {
                    "status": "configured" if claude_key != "your_claude_api_key_here" else "not_configured"
                },
                "openai": {
                    "status": "configured" if openai_key != "your_openai_api_key_here" else "not_configured"
                }
            }
        except Exception as e:
            health_status["components"]["ai_providers"] = {
                "status": "error",
                "error": str(e)
            }
        
        # Overall status
        component_statuses = [
            comp.get("status", "unknown") 
            for comp in health_status["components"].values()
        ]
        
        if any(status == "unhealthy" for status in component_statuses):
            health_status["status"] = "degraded"
        elif any(status in ["not_configured", "error"] for status in component_statuses):
            health_status["status"] = "warning"
        
        return health_status
    
    # Include routers with proper prefixes
    app.include_router(health.router, prefix="/api/v1", tags=["Health"])
    app.include_router(auth.router, prefix="/api/v1", tags=["Authentication"])
    app.include_router(system.router, prefix="/api/v1", tags=["System"])
    app.include_router(pdfs.router, prefix="/api/v1", tags=["PDFs"])
    app.include_router(sessions.router, prefix="/api/v1", tags=["Sessions"])
    app.include_router(flashcards.router, prefix="/api/v1", tags=["Flashcards"])
    
    # AI Proxy router (already has /api/v1/ai-proxy prefix)
    app.include_router(ai_providers.router, tags=["AI Proxy"])

    # Serve static files (PDFs) from the configured storage path
    pdf_storage_path = settings.actual_pdf_storage_path
    if Path(pdf_storage_path).exists():
        app.mount("/static", StaticFiles(directory=pdf_storage_path), name="static")
        logger.info(f"Static files mounted from: {pdf_storage_path}")
    else:
        logger.warning(f"PDF storage directory not found, static files not mounted: {pdf_storage_path}")
    
    return app


# Create the application
app = create_application()


def setup_signal_handlers():
    """Setup graceful shutdown signal handlers"""
    
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, initiating graceful shutdown...")
        # FastAPI will handle the shutdown via lifespan
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)


def run_development_server():
    """Run the development server with auto-reload"""
    
    setup_signal_handlers()
    
    logger.info("Starting development server...")
    
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
        reload_dirs=["app"],
        log_level=settings.log_level.lower(),
        access_log=settings.enable_access_logs
    )


def run_production_server():
    """Run the production server with proper configuration"""
    
    setup_signal_handlers()
    
    logger.info("Starting production server...")
    
    # Production server configuration
    config = uvicorn.Config(
        app=app,
        host=settings.api_host,
        port=settings.api_port,
        log_level=settings.log_level.lower(),
        access_log=settings.enable_access_logs,
        workers=1,  # Single worker for now, can be increased
        loop="uvloop",  # High-performance event loop
        http="httptools",  # High-performance HTTP parser
        backlog=2048,  # Connection backlog
        limit_concurrency=1000,  # Max concurrent connections
        limit_max_requests=10000,  # Max requests per worker
        timeout_keep_alive=30,  # Keep-alive timeout
        timeout_graceful_shutdown=30,  # Graceful shutdown timeout
    )
    
    # SSL configuration for production
    if settings.ssl_cert_path and settings.ssl_key_path:
        config.ssl_certfile = settings.ssl_cert_path
        config.ssl_keyfile = settings.ssl_key_path
        logger.info("SSL/TLS enabled")
    
    server = uvicorn.Server(config)
    server.run()


if __name__ == "__main__":
    """Entry point for running the application"""
    
    if settings.environment == "development":
        run_development_server()
    else:
        run_production_server()