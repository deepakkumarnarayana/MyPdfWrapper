"""
Modern FastAPI Configuration Management using Pydantic Settings.
Follows 2024 best practices for environment configuration.
"""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional
import ssl
import socket

from pydantic import Field, computed_field, field_validator, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings using Pydantic BaseSettings.
    Automatically loads from .env file and environment variables.
    """
    
    # Application Configuration
    environment: str = Field(default="development", description="Application environment")
    debug: bool = Field(default=True, description="Debug mode")
    app_name: str = Field(default="PDF Learning Platform", description="Application name")
    
    # API Configuration
    api_host: str = Field(default="0.0.0.0", description="API host")
    api_port: int = Field(default=8000, description="API port")
    
    # Database Configuration
    database_url: Optional[str] = Field(default=None, description="Database URL")
    
    # Storage Configuration
    pdf_storage_path: Optional[str] = Field(default=None, description="PDF storage path")
    max_file_size: int = Field(default=50485760, description="Maximum file size in bytes")  # 50MB
    allowed_file_types: str = Field(default=".pdf", description="Allowed file types")
    
    # AI Configuration - Using SecretStr for security
    claude_api_key: SecretStr = Field(default="your_claude_api_key_here", description="Claude AI API key")
    max_flashcards_per_generation: int = Field(default=10, ge=1, le=50, description="Max flashcards per generation")
    default_ai_model: str = Field(default="claude-3-sonnet", description="Default AI model")
    
    # AWS Configuration
    aws_s3_bucket: Optional[str] = Field(default=None, description="AWS S3 bucket name")
    aws_region: str = Field(default="us-east-1", description="AWS region")
    pdf_url_expiry_hours: int = Field(default=24, description="PDF URL expiry hours")
    
    # CORS Configuration
    allowed_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        description="Allowed CORS origins"
    )
    
    # Logging Configuration
    log_level: str = Field(default="DEBUG", description="Logging level")
    enable_access_logs: bool = Field(default=True, description="Enable access logs")
    
    # Security Configuration (Development)
    enable_hsts: bool = Field(default=False, description="Enable HSTS")
    secure_cookies: bool = Field(default=False, description="Secure cookies")
    hsts_max_age: int = Field(default=31536000, description="HSTS max age in seconds")
    allowed_hosts: str = Field(default="localhost,127.0.0.1", description="Allowed hosts")
    
    # SSL Configuration (Production)
    ssl_cert_path: Optional[str] = Field(default=None, description="SSL certificate path")
    ssl_key_path: Optional[str] = Field(default=None, description="SSL key path")
    domain: Optional[str] = Field(default=None, description="Domain name")
    
    # Application Constants
    supported_languages: str = Field(default="en,es,fr,de", description="Supported languages")
    session_timeout_minutes: int = Field(default=60, description="Session timeout in minutes")
    
    # Configure Pydantic to load from environment-specific .env file  
    # Note: Files are loaded in order, with later files overriding earlier ones
    model_config = SettingsConfigDict(
        env_file=[
            Path(__file__).parent.parent.parent.parent / ".env",  # Load general .env first (contains ENVIRONMENT)
            Path(__file__).parent.parent.parent.parent / f".env.{os.getenv('ENVIRONMENT', 'development')}"  # Then load environment-specific
        ],
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"  # Ignore extra environment variables
    )
    
    @computed_field
    @property
    def project_root(self) -> Path:
        """Calculate project root consistently (4 levels up from app/config.py)."""
        return Path(__file__).parent.parent.parent.parent.resolve()
    
    @computed_field
    @property
    def storage_dir(self) -> Path:
        """Storage directory path."""
        return self.project_root / "data" / "storage"
    
    @computed_field
    @property
    def pdf_storage_dir(self) -> Path:
        """PDF storage directory path."""
        return self.storage_dir / "pdfs"
    
    @computed_field
    @property
    def actual_pdf_storage_path(self) -> str:
        """Actual PDF storage path (from env var or computed default)."""
        if self.pdf_storage_path:
            return self.pdf_storage_path
        return str(self.pdf_storage_dir)
    
    @computed_field
    @property
    def actual_database_url(self) -> str:
        """Actual database URL (from env var or computed default)."""
        if self.database_url:
            return self.database_url
        return f"sqlite+aiosqlite:///{self.storage_dir}/database.db"
    
    @computed_field
    @property
    def allowed_origins_list(self) -> list[str]:
        """Convert allowed origins string to list."""
        return [origin.strip() for origin in self.allowed_origins.split(",")]
    
    @computed_field
    @property 
    def allowed_hosts_list(self) -> list[str]:
        """Convert allowed hosts string to list."""
        return [host.strip() for host in self.allowed_hosts.split(",")]
    
    # Security Validators
    @field_validator('pdf_storage_path')
    @classmethod
    def validate_storage_path(cls, v):
        """Validate storage path for security"""
        if v and '..' in v:
            raise ValueError("Path traversal detected in PDF storage path")
        if v and not Path(v).is_absolute():
            raise ValueError("PDF storage path must be absolute")
        return v
    
    @field_validator('database_url')
    @classmethod
    def validate_database_url(cls, v):
        """Validate database URL security"""
        if not v:
            return v
        
        allowed_schemes = ['sqlite+aiosqlite', 'postgresql+asyncpg', 'mysql+aiomysql']
        if not any(v.startswith(scheme + '://') for scheme in allowed_schemes):
            raise ValueError(f"Database URL must use one of: {allowed_schemes}")
        
        # Require SSL for non-sqlite databases in production
        env = os.getenv('ENVIRONMENT', 'development')
        if env == 'production' and not v.startswith('sqlite') and 'ssl' not in v.lower():
            raise ValueError("Production database connections must use SSL")
        
        return v
    
    @field_validator('allowed_origins')
    @classmethod
    def validate_allowed_origins(cls, v):
        """Validate CORS origins for security"""
        origins = [origin.strip() for origin in v.split(',')]
        env = os.getenv('ENVIRONMENT', 'development')
        
        if env == 'production':
            for origin in origins:
                if not origin.startswith(('https://', 'http://localhost')):
                    raise ValueError(f"Production origins must use HTTPS: {origin}")
        
        return v
    
    @field_validator('claude_api_key')
    @classmethod
    def validate_claude_api_key(cls, v):
        """Validate Claude API key format"""
        if isinstance(v, SecretStr):
            key_value = v.get_secret_value()
        else:
            key_value = v
            
        if key_value == "your_claude_api_key_here":
            if os.getenv('ENVIRONMENT') == 'production':
                raise ValueError("Production requires a valid Claude API key")
        
        return v
    
    def setup_directories(self) -> None:
        """Ensure all required directories exist."""
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.pdf_storage_dir.mkdir(parents=True, exist_ok=True)
        
        # Also create custom PDF storage path if specified
        if self.pdf_storage_path:
            Path(self.pdf_storage_path).mkdir(parents=True, exist_ok=True)
    
    def debug_configuration(self) -> None:
        """Print configuration for debugging (development only)."""
        if not self.debug:
            return
            
        print("=" * 60)
        print("📋 PDF LEARNING PLATFORM CONFIGURATION")
        print("=" * 60)
        print(f"🏠 Project Root: {self.project_root}")
        print(f"💾 Storage Directory: {self.storage_dir}")
        print(f"📁 PDF Storage Path: {self.actual_pdf_storage_path}")
        print(f"🗄️  Database URL: {self.actual_database_url}")
        print(f"🌍 Environment: {self.environment}")
        print(f"🐛 Debug Mode: {self.debug}")
        print(f"🔌 API: {self.api_host}:{self.api_port}")
        print(f"📋 Log Level: {self.log_level}")
        print(f"🔐 Claude API Key: {'Configured' if self.claude_api_key.get_secret_value() != 'your_claude_api_key_here' else 'Not Set'}")
        print("=" * 60)
    
    def validate_configuration(self) -> dict[str, bool]:
        """Validate critical configuration components for production readiness."""
        results = {
            "environment_valid": self.environment in ['development', 'staging', 'production'],
            "storage_accessible": self._test_storage_access(),
            "database_reachable": self._test_database_reachability(),
            "api_keys_configured": self._validate_api_keys(),
            "security_headers_enabled": self._validate_security_settings(),
            "ssl_configured": self._validate_ssl_configuration(),
        }
        
        return results
    
    def _test_storage_access(self) -> bool:
        """Test if storage directory is accessible and writable."""
        try:
            storage_path = Path(self.actual_pdf_storage_path)
            storage_path.mkdir(parents=True, exist_ok=True)
            
            # Test write permissions
            test_file = storage_path / ".write_test"
            test_file.write_text("test")
            test_file.unlink()
            return True
        except Exception:
            return False
    
    def _test_database_reachability(self) -> bool:
        """Test if database is reachable (basic connectivity)."""
        try:
            db_url = self.actual_database_url
            if db_url.startswith('sqlite'):
                # For SQLite, check if parent directory is writable
                db_path = Path(db_url.replace('sqlite+aiosqlite:///', ''))
                return db_path.parent.exists() and os.access(db_path.parent, os.W_OK)
            else:
                # For other databases, try to parse URL and test basic connectivity
                from urllib.parse import urlparse
                parsed = urlparse(db_url)
                if parsed.hostname:
                    # Basic socket test
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.settimeout(5)
                    result = sock.connect_ex((parsed.hostname, parsed.port or 5432))
                    sock.close()
                    return result == 0
            return True
        except Exception:
            return False
    
    def _validate_api_keys(self) -> bool:
        """Validate that required API keys are configured."""
        claude_key = self.claude_api_key.get_secret_value()
        return claude_key != "your_claude_api_key_here" and len(claude_key) > 10
    
    def _validate_security_settings(self) -> bool:
        """Validate security configuration."""
        if self.environment == 'production':
            return (
                self.enable_hsts and
                self.secure_cookies and  
                not self.debug and
                self.log_level in ['WARNING', 'ERROR']
            )
        return True
    
    def _validate_ssl_configuration(self) -> bool:
        """Validate SSL configuration for production."""
        if self.environment != 'production':
            return True
            
        if not self.ssl_cert_path or not self.ssl_key_path:
            return False
            
        cert_path = Path(self.ssl_cert_path)
        key_path = Path(self.ssl_key_path)
        
        return cert_path.exists() and key_path.exists()


@lru_cache()
def get_settings() -> Settings:
    """
    Get application settings with LRU cache for performance.
    This prevents reading the .env file multiple times.
    """
    settings = Settings()
    settings.setup_directories()
    settings.debug_configuration()
    return settings


# Export settings instance for backward compatibility
settings = get_settings()