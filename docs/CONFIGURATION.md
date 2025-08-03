# Configuration System Documentation

## 🔧 **Modern FastAPI Configuration Management**

This document covers the comprehensive configuration system built with Pydantic Settings, featuring environment profiles, security hardening, and production-ready validation.

---

## 📋 **Configuration Architecture**

### **File Structure**
```
├── .env                    # Application constants + ENVIRONMENT selector
├── .env.development       # Development-specific overrides
├── .env.staging          # Staging-specific overrides  
├── .env.production       # Production-specific overrides
└── src/backend/app/config.py  # Pydantic Settings implementation
```

### **Design Principles**
- **Separation of Concerns**: Application constants vs environment-specific settings
- **Type Safety**: Full Pydantic validation with proper types
- **Security First**: SecretStr for sensitive data, comprehensive validation
- **Environment Profiles**: Easy switching between dev/staging/production

---

## ⚙️ **Settings Categories**

### **Application Constants** (`.env`)
Settings that are **the same across all environments**:

```bash
# Application Metadata
APP_NAME="PDF Learning Platform"
MAX_FILE_SIZE=52428800  # 50MB
ALLOWED_FILE_TYPES=".pdf"

# AI Configuration
MAX_FLASHCARDS_PER_GENERATION=10
DEFAULT_AI_MODEL="claude-3-sonnet"

# AWS Configuration  
AWS_REGION="us-east-1"
PDF_URL_EXPIRY_HOURS=24

# Security Defaults
HSTS_MAX_AGE=31536000
ALLOWED_HOSTS="localhost,127.0.0.1"
```

### **Environment-Specific** (`.env.{environment}`)
Settings that **change between environments**:

| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| `ENVIRONMENT` | development | staging | production |
| `DEBUG` | true | true | false |
| `LOG_LEVEL` | DEBUG | INFO | WARNING |
| `API_PORT` | 8000 | 8000 | 443 |
| `ALLOWED_ORIGINS` | localhost:3000 | staging.com | yourdomain.com |
| `ENABLE_HSTS` | false | true | true |
| `CLAUDE_API_KEY` | dev-key | staging-key | prod-key |

---

## 🔐 **Security Features**

### **SecretStr Implementation**
All sensitive data uses Pydantic SecretStr for secure handling:

```python
# Secure API key handling
claude_api_key: SecretStr = Field(...)

# Access secret value safely
api_key = settings.claude_api_key.get_secret_value()

# Secrets appear as *** in logs
print(settings.claude_api_key)  # SecretStr('***')
```

### **Input Validation**
Comprehensive validation protects against security vulnerabilities:

```python
@field_validator('pdf_storage_path')
@classmethod
def validate_storage_path(cls, v):
    if v and '..' in v:
        raise ValueError("Path traversal detected")
    return v

@field_validator('database_url')
@classmethod  
def validate_database_url(cls, v):
    # Require SSL for production databases
    if env == 'production' and 'ssl' not in v.lower():
        raise ValueError("Production requires SSL")
    return v
```

### **Production Validation**
Built-in validation ensures production readiness:

```python
def validate_configuration(self) -> dict[str, bool]:
    return {
        "environment_valid": self.environment in ['development', 'staging', 'production'],
        "storage_accessible": self._test_storage_access(),
        "database_reachable": self._test_database_reachability(),
        "api_keys_configured": self._validate_api_keys(),
        "security_headers_enabled": self._validate_security_settings(),
        "ssl_configured": self._validate_ssl_configuration(),
    }
```

---

## 🔄 **Environment Management**

### **Switching Environments**
Change environment by editing one line in `.env`:

```bash
# Development
ENVIRONMENT=development

# Staging  
ENVIRONMENT=staging

# Production
ENVIRONMENT=production
```

### **Environment Loading Process**
1. **Load Base Settings**: Reads `.env` file for application constants
2. **Determine Environment**: Gets `ENVIRONMENT` value from `.env` 
3. **Load Overrides**: Reads `.env.{ENVIRONMENT}` for specific settings
4. **Apply Validation**: Runs security and configuration validation
5. **Cache Settings**: Uses `@lru_cache` for performance

### **File Loading Order**
```python
# Pydantic loads in order (later files override earlier)
env_file=[
    ".env",                          # Application constants
    f".env.{ENVIRONMENT}"           # Environment-specific overrides
]
```

---

## 📊 **Configuration Fields**

### **Core Settings**
```python
class Settings(BaseSettings):
    # Environment Control
    environment: str = Field(default="development")
    debug: bool = Field(default=True)
    
    # API Configuration
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8000)
    
    # Database & Storage
    database_url: Optional[str] = Field(default=None)
    pdf_storage_path: Optional[str] = Field(default=None)
    
    # AI Configuration (Secure)
    claude_api_key: SecretStr = Field(...)
    max_flashcards_per_generation: int = Field(default=10, ge=1, le=50)
    
    # Security Settings
    enable_hsts: bool = Field(default=False)
    secure_cookies: bool = Field(default=False)
    allowed_origins: str = Field(default="http://localhost:3000")
    
    # SSL Configuration
    ssl_cert_path: Optional[str] = Field(default=None)
    ssl_key_path: Optional[str] = Field(default=None)
    domain: Optional[str] = Field(default=None)
```

### **Computed Fields**
Dynamic values calculated from base settings:

```python
@computed_field
@property
def actual_pdf_storage_path(self) -> str:
    """Actual PDF storage path (env var or computed default)"""
    return self.pdf_storage_path or str(self.pdf_storage_dir)

@computed_field  
@property
def allowed_origins_list(self) -> list[str]:
    """Convert comma-separated origins to list"""
    return [origin.strip() for origin in self.allowed_origins.split(",")]
```

---

## 🧪 **Testing & Validation**

### **Configuration Testing**
```bash
# Test current configuration
python scripts/debug/test_config.py

# Test specific environment
ENV=staging python scripts/debug/test_config.py

# Validate configuration health
python scripts/debug/validate_services.py
```

### **Health Check Endpoints**
```bash
# Basic health check (always available)
GET /health

# Configuration validation (development only)
GET /config/validate
{
  "status": "healthy",
  "environment": "development", 
  "validation_results": {
    "environment_valid": true,
    "storage_accessible": true,
    "database_reachable": true,
    "api_keys_configured": true,
    "security_headers_enabled": true,
    "ssl_configured": true
  },
  "recommendations": ["Configuration appears healthy"]
}
```

### **Debug Scripts**
- `test_config.py` - Test configuration loading across environments
- `debug_env_loading.py` - Debug environment file loading issues
- `test_paths.py` - Test path computations and storage
- `validate_services.py` - Validate service configurations
- `browse_database.py` - Interactive database browser
- `test_database.py` - Database connectivity testing

---

## 🔧 **Usage Examples**

### **Basic Usage**
```python
from app.config import get_settings

# Get settings instance (cached)
settings = get_settings()

# Access configuration
print(f"Environment: {settings.environment}")
print(f"Debug mode: {settings.debug}")
print(f"API port: {settings.api_port}")

# Access secrets securely
api_key = settings.claude_api_key.get_secret_value()

# Use computed fields
storage_path = settings.actual_pdf_storage_path
origins = settings.allowed_origins_list
```

### **Dependency Injection**
```python
from fastapi import Depends
from app.config import get_settings, Settings

@app.get("/info")
async def get_info(settings: Settings = Depends(get_settings)):
    return {
        "app_name": settings.app_name,
        "environment": settings.environment,
        "version": "1.0.0"
    }
```

### **Configuration Validation**
```python
# Validate before deployment
settings = get_settings()
validation = settings.validate_configuration()

if not all(validation.values()):
    print("❌ Configuration issues detected!")
    for check, status in validation.items():
        if not status:
            print(f"  - {check}: FAILED")
else:
    print("✅ Configuration is production-ready!")
```

---

## 🚨 **Security Best Practices**

### **Secrets Management**
- ✅ Use `SecretStr` for all sensitive configuration
- ✅ Store secrets in environment variables, not files
- ✅ Use external secret management (Vault, AWS Secrets Manager)
- ✅ Never commit secrets to version control
- ✅ Validate secret format and length

### **Production Security**
- ✅ Disable debug mode in production
- ✅ Use HTTPS-only CORS origins
- ✅ Enable security headers (HSTS, CSP)
- ✅ Validate SSL certificate paths
- ✅ Require database SSL connections
- ✅ Use secure cookie settings

### **Input Validation**
- ✅ Validate all file paths for traversal attacks
- ✅ Validate database URLs and schemes
- ✅ Validate API key formats
- ✅ Use Pydantic constraints (ge, le, regex)
- ✅ Implement custom validators for security

---

## 🔄 **Migration & Updates**

### **Adding New Configuration**
1. Add field to `Settings` class with proper type and validation
2. Add to appropriate environment files
3. Update computed fields if needed
4. Add validation if security-sensitive
5. Update documentation

### **Environment Changes**
```python
# Example: Adding new security setting
class Settings(BaseSettings):
    # Add new field with validation
    rate_limit_enabled: bool = Field(default=True)
    rate_limit_requests: int = Field(default=100, ge=1, le=10000)
    
    @field_validator('rate_limit_requests')
    @classmethod
    def validate_rate_limit(cls, v):
        if v > 1000 and os.getenv('ENVIRONMENT') == 'production':
            raise ValueError("Production rate limit too high")
        return v
```

---

## 📈 **Performance Considerations**

### **Caching Strategy**
- `@lru_cache()` on `get_settings()` prevents repeated file reads
- Settings loaded once per application lifecycle
- Computed fields calculated lazily
- Cache invalidation available for hot reloading

### **Memory Usage**
- Minimal memory footprint with efficient field types
- Secrets secured in memory with SecretStr
- Optional fields use minimal resources when unset
- Path objects use efficient Path type

---

## 🛠️ **Troubleshooting**

### **Common Issues**

**Environment not loading correctly:**
```bash
# Check environment file exists
ls -la .env.*

# Test environment loading
python scripts/debug/debug_env_loading.py
```

**API keys not working:**
```bash
# Check secret configuration
python -c "from app.config import get_settings; s=get_settings(); print('Key configured:', s.claude_api_key.get_secret_value() != 'your_claude_api_key_here')"
```

**Path issues:**
```bash
# Test path calculations
python scripts/debug/test_paths.py
```

**Production validation failing:**
```bash
# Run comprehensive validation
python -c "from app.config import get_settings; print(get_settings().validate_configuration())"
```

---

*This configuration system provides enterprise-grade security and flexibility while maintaining simplicity for development workflows.*