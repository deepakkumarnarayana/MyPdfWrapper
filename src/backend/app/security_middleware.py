"""
Modern HTTPS-Only Security Middleware
Implements OWASP 2025 standards for secure HTTP handling
"""

from fastapi import FastAPI, Request, Response, HTTPException
from fastapi.middleware.base import BaseHTTPMiddleware
from fastapi.responses import RedirectResponse
from app.config import get_settings
import os
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class HTTPSEnforcementMiddleware(BaseHTTPMiddleware):
    """
    Modern security middleware that enforces HTTPS-only connections
    with HSTS headers and proper security configurations.
    
    NO HTTP FALLBACK - This is the 2025 security standard.
    """
    
    def __init__(self, app, enable_hsts: bool = True, hsts_max_age: int = 31536000):
        super().__init__(app)
        settings = get_settings()
        self.enable_hsts = enable_hsts
        self.hsts_max_age = hsts_max_age
        self.is_production = settings.environment == "production"
        
        # Log security configuration
        logger.info(f"HTTPS Enforcement: {'Enabled' if self.is_production else 'Development Mode'}")
        logger.info(f"HSTS: {'Enabled' if self.enable_hsts else 'Disabled'}")

    async def dispatch(self, request: Request, call_next):
        # 1. HTTPS Enforcement (Production Only)
        if self.is_production and request.url.scheme != "https":
            # Force HTTPS redirect - NO HTTP FALLBACK
            https_url = str(request.url).replace("http://", "https://", 1)
            logger.warning(f"HTTP request redirected to HTTPS: {request.url} -> {https_url}")
            return RedirectResponse(url=https_url, status_code=301)
        
        # 2. Process the request
        response = await call_next(request)
        
        # 3. Add Security Headers
        self.add_security_headers(response, request)
        
        return response

    def add_security_headers(self, response: Response, request: Request) -> None:
        """Add comprehensive security headers following OWASP 2025 guidelines"""
        
        # HSTS (HTTP Strict Transport Security) - Prevents downgrade attacks
        if self.enable_hsts and (request.url.scheme == "https" or not self.is_production):
            hsts_header = f"max-age={self.hsts_max_age}; includeSubDomains"
            if self.is_production:
                hsts_header += "; preload"  # Only add preload in production
            response.headers["Strict-Transport-Security"] = hsts_header

        # Content Security Policy - Prevents XSS
        csp_policy = self.get_csp_policy()
        response.headers["Content-Security-Policy"] = csp_policy
        
        # Additional Security Headers
        response.headers.update({
            # Prevent MIME type sniffing
            "X-Content-Type-Options": "nosniff",
            
            # Prevent clickjacking
            "X-Frame-Options": "DENY",
            
            # XSS Protection (legacy but still useful)
            "X-XSS-Protection": "1; mode=block",
            
            # Control referrer information
            "Referrer-Policy": "strict-origin-when-cross-origin",
            
            # Prevent Adobe Flash policy requests
            "X-Permitted-Cross-Domain-Policies": "none",
            
            # Disable DNS prefetching
            "X-DNS-Prefetch-Control": "off",
            
            # Expect-CT header for certificate transparency
            "Expect-CT": "max-age=86400, enforce",
        })

        # Cache control for sensitive endpoints
        if self.is_sensitive_endpoint(request.url.path):
            response.headers.update({
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0"
            })

    def get_csp_policy(self) -> str:
        """Generate Content Security Policy based on environment"""
        if self.is_production:
            return (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: https:; "
                "connect-src 'self'; "
                "frame-src 'none'; "
                "object-src 'none'; "
                "base-uri 'self'; "
                "form-action 'self'; "
                "upgrade-insecure-requests"
            )
        else:
            # More lenient for development
            return (
                "default-src 'self' 'unsafe-inline' 'unsafe-eval'; "
                "connect-src 'self' ws: http: https:; "
                "img-src 'self' data: http: https:"
            )

    def is_sensitive_endpoint(self, path: str) -> bool:
        """Check if endpoint contains sensitive data requiring strict caching"""
        sensitive_patterns = [
            "/auth/", "/api/user/", "/api/admin/", 
            "/api/payments/", "/api/personal/"
        ]
        return any(pattern in path for pattern in sensitive_patterns)


class SecurityValidationMiddleware(BaseHTTPMiddleware):
    """Additional security validations for modern web security"""
    
    async def dispatch(self, request: Request, call_next):
        # Validate Host header to prevent Host header injection
        if not self.is_valid_host(request.headers.get("host", "")):
            logger.warning(f"Invalid host header: {request.headers.get('host')}")
            raise HTTPException(status_code=400, detail="Invalid host header")
        
        # Check for suspicious request patterns
        if self.is_suspicious_request(request):
            logger.warning(f"Suspicious request blocked: {request.url}")
            raise HTTPException(status_code=429, detail="Request blocked")
        
        response = await call_next(request)
        return response

    def is_valid_host(self, host: str) -> bool:
        """Validate the Host header against allowed hosts"""
        settings = get_settings()
        allowed_hosts = settings.allowed_hosts_list
        
        # Remove port from host if present
        host_without_port = host.split(":")[0] if ":" in host else host
        
        return host_without_port in allowed_hosts or host_without_port.endswith(".yourdomain.com")

    def is_suspicious_request(self, request: Request) -> bool:
        """Basic suspicious request detection"""
        suspicious_patterns = [
            # SQL injection attempts
            "union select", "drop table", "insert into",
            # XSS attempts
            "<script", "javascript:", "onload=",
            # Path traversal
            "../", "..\\", "%2e%2e",
            # Command injection
            "; cat ", "| nc ", "&& rm "
        ]
        
        # Check URL and query parameters
        url_string = str(request.url).lower()
        return any(pattern in url_string for pattern in suspicious_patterns)


def setup_security_middleware(app: FastAPI) -> None:
    """
    Configure all security middleware for the FastAPI application.
    
    This implements modern security standards:
    - HTTPS-only with HSTS
    - Comprehensive security headers
    - Request validation
    - No HTTP fallback (security best practice)
    """
    
    # Environment configuration using centralized settings
    settings = get_settings()
    environment = settings.environment
    enable_hsts = settings.enable_hsts
    hsts_max_age = settings.hsts_max_age
    
    # Add security middleware in order
    app.add_middleware(
        SecurityValidationMiddleware
    )
    
    app.add_middleware(
        HTTPSEnforcementMiddleware,
        enable_hsts=enable_hsts,
        hsts_max_age=hsts_max_age
    )
    
    logger.info("✅ Security middleware configured successfully")
    logger.info(f"Environment: {environment}")
    logger.info(f"HTTPS Enforcement: {'Production' if environment == 'production' else 'Development'}")


# Example usage in main.py
def create_secure_app() -> FastAPI:
    """Create a FastAPI app with modern security configuration"""
    settings = get_settings()
    
    app = FastAPI(
        title="Secure PDF Reader API",
        description="Production-ready API with HTTPS-only security",
        version="1.0.0",
        # Important: Set docs_url and redoc_url to None in production
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
    )
    
    # Configure security middleware
    setup_security_middleware(app)
    
    # Add CORS with secure configuration
    from fastapi.middleware.cors import CORSMiddleware
    
    if settings.environment == "production":
        # Production CORS - restrictive
        allowed_origins = settings.allowed_origins_list
        app.add_middleware(
            CORSMiddleware,
            allow_origins=allowed_origins,  # Specific origins only
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE"],
            allow_headers=["*"],
        )
    else:
        # Development CORS - permissive
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:3000", "http://localhost:3001"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
    
    return app


# Health check endpoint that works with HTTPS enforcement
@app.get("/health")
async def health_check():
    """
    Health check endpoint that includes security status.
    This helps verify HTTPS and security headers are working.
    """
    settings = get_settings()
    return {
        "status": "healthy",
        "security": {
            "https_enforced": settings.environment == "production",
            "hsts_enabled": settings.enable_hsts,
            "environment": settings.environment
        },
        "timestamp": "2025-01-01T00:00:00Z"  # Use actual timestamp
    }


# Example environment configuration (.env)
ENV_EXAMPLE = """
# Security Configuration for HTTPS-Only Setup
ENVIRONMENT=production
ENABLE_HSTS=true
HSTS_MAX_AGE=31536000
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# SSL/TLS Configuration (if using custom certificates)
SSL_CERT_PATH=/path/to/certificate.pem
SSL_KEY_PATH=/path/to/private-key.pem

# Database (use SSL connection string)
DATABASE_URL=postgresql+asyncio://user:pass@localhost:5432/db?sslmode=require
"""