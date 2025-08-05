"""
Comprehensive Logging Service for AI Proxy Operations
Production-ready logging with structured logs, metrics, and monitoring integration.
"""

import json
import logging
import logging.handlers
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List, Callable
from contextvars import ContextVar
from dataclasses import dataclass, asdict
from enum import Enum

from app.config import get_settings

# Context variables for request tracking
request_id_context: ContextVar[Optional[str]] = ContextVar('request_id', default=None)
user_id_context: ContextVar[Optional[int]] = ContextVar('user_id', default=None)
session_id_context: ContextVar[Optional[str]] = ContextVar('session_id', default=None)


class LogLevel(Enum):
    """Log levels with numeric values"""
    DEBUG = 10
    INFO = 20
    WARNING = 30
    ERROR = 40
    CRITICAL = 50


class LogCategory(Enum):
    """Log categories for better organization"""
    SECURITY = "security"
    PERFORMANCE = "performance"
    AI_PROXY = "ai_proxy"
    RATE_LIMIT = "rate_limit"
    CACHE = "cache"
    DATABASE = "database"
    AUTHENTICATION = "authentication"
    BUSINESS_LOGIC = "business_logic"
    INTEGRATION = "integration"
    SYSTEM = "system"


@dataclass
class LogMetadata:
    """Structured log metadata"""
    timestamp: str
    level: str
    category: str
    request_id: Optional[str] = None
    user_id: Optional[int] = None
    session_id: Optional[str] = None
    component: Optional[str] = None
    operation: Optional[str] = None
    duration_ms: Optional[int] = None
    status_code: Optional[int] = None
    error_code: Optional[str] = None
    threat_level: Optional[str] = None
    provider: Optional[str] = None
    cost_usd: Optional[float] = None
    tokens_used: Optional[int] = None
    cache_hit: Optional[bool] = None
    rate_limited: Optional[bool] = None
    client_ip: Optional[str] = None
    user_agent: Optional[str] = None


class StructuredFormatter(logging.Formatter):
    """Custom formatter for structured JSON logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        # Get context variables
        request_id = request_id_context.get()
        user_id = user_id_context.get()
        session_id = session_id_context.get()
        
        # Base log structure
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add context
        if request_id:
            log_data["request_id"] = request_id
        if user_id:
            log_data["user_id"] = user_id
        if session_id:
            log_data["session_id"] = session_id
        
        # Add extra fields from log record
        extra_fields = getattr(record, 'extra_fields', {})
        if extra_fields:
            log_data.update(extra_fields)
        
        # Add exception info
        if record.exc_info:
            log_data["exception"] = {
                "type": record.exc_info[0].__name__ if record.exc_info[0] else None,
                "message": str(record.exc_info[1]) if record.exc_info[1] else None,
                "traceback": traceback.format_exception(*record.exc_info)
            }
        
        return json.dumps(log_data, default=str, ensure_ascii=False)


class AIProxyLogger:
    """Enhanced logger for AI Proxy operations with structured logging"""
    
    def __init__(self, name: str):
        self.name = name
        self.logger = logging.getLogger(name)
        self.settings = get_settings()
        self._setup_logger()
    
    def _setup_logger(self):
        """Setup logger with appropriate handlers and formatting"""
        if self.logger.handlers:
            return  # Already configured
        
        self.logger.setLevel(getattr(logging, self.settings.log_level.upper(), logging.INFO))
        
        # Console handler with structured formatting
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.DEBUG)
        
        if self.settings.environment == "production":
            # Production: JSON structured logs
            console_formatter = StructuredFormatter()
        else:
            # Development: Human-readable logs
            console_formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
        
        console_handler.setFormatter(console_formatter)
        self.logger.addHandler(console_handler)
        
        # File handler for persistent logging
        if self.settings.environment in ["staging", "production"]:
            log_dir = Path(self.settings.project_root) / "logs"
            log_dir.mkdir(exist_ok=True)
            
            # Rotating file handler
            file_handler = logging.handlers.RotatingFileHandler(
                log_dir / f"{self.name}.log",
                maxBytes=10 * 1024 * 1024,  # 10MB
                backupCount=5
            )
            file_handler.setLevel(logging.INFO)
            file_handler.setFormatter(StructuredFormatter())
            self.logger.addHandler(file_handler)
            
            # Error-only file handler
            error_handler = logging.handlers.RotatingFileHandler(
                log_dir / f"{self.name}_errors.log",
                maxBytes=5 * 1024 * 1024,  # 5MB
                backupCount=10
            )
            error_handler.setLevel(logging.ERROR)
            error_handler.setFormatter(StructuredFormatter())
            self.logger.addHandler(error_handler)
    
    def _log_with_metadata(
        self, 
        level: LogLevel, 
        message: str, 
        category: LogCategory,
        **kwargs
    ):
        """Log with structured metadata"""
        extra_fields = {
            "category": category.value,
            **kwargs
        }
        
        # Filter None values
        extra_fields = {k: v for k, v in extra_fields.items() if v is not None}
        
        self.logger.log(
            level.value, 
            message, 
            extra={"extra_fields": extra_fields}
        )
    
    # Security logging methods
    def security_event(
        self, 
        message: str, 
        threat_level: str = "low",
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        **kwargs
    ):
        """Log security events"""
        self._log_with_metadata(
            LogLevel.WARNING,
            message,
            LogCategory.SECURITY,
            threat_level=threat_level,
            client_ip=client_ip,
            user_agent=user_agent,
            **kwargs
        )
    
    def security_violation(
        self, 
        message: str, 
        violation_type: str,
        client_ip: Optional[str] = None,
        **kwargs
    ):
        """Log security violations"""
        self._log_with_metadata(
            LogLevel.ERROR,
            message,
            LogCategory.SECURITY,
            threat_level="critical",
            violation_type=violation_type,
            client_ip=client_ip,
            **kwargs
        )
    
    # AI Proxy specific logging methods
    def ai_request_start(
        self, 
        provider: str, 
        model: str,
        estimated_tokens: Optional[int] = None,
        **kwargs
    ):
        """Log AI request initiation"""
        self._log_with_metadata(
            LogLevel.INFO,
            f"AI request started: {provider}/{model}",
            LogCategory.AI_PROXY,
            provider=provider,
            model=model,
            estimated_tokens=estimated_tokens,
            operation="request_start",
            **kwargs
        )
    
    def ai_request_complete(
        self,
        provider: str,
        model: str,
        duration_ms: int,
        tokens_used: Optional[int] = None,
        cost_usd: Optional[float] = None,
        cached: bool = False,
        **kwargs
    ):
        """Log AI request completion"""
        self._log_with_metadata(
            LogLevel.INFO,
            f"AI request completed: {provider}/{model} in {duration_ms}ms",
            LogCategory.AI_PROXY,
            provider=provider,
            model=model,
            duration_ms=duration_ms,
            tokens_used=tokens_used,
            cost_usd=cost_usd,
            cache_hit=cached,
            operation="request_complete",
            **kwargs
        )
    
    def ai_request_error(
        self,
        provider: str,
        model: str,
        error_type: str,
        error_message: str,
        duration_ms: Optional[int] = None,
        **kwargs
    ):
        """Log AI request errors"""
        self._log_with_metadata(
            LogLevel.ERROR,
            f"AI request failed: {provider}/{model} - {error_message}",
            LogCategory.AI_PROXY,
            provider=provider,
            model=model,
            error_code=error_type,
            duration_ms=duration_ms,
            operation="request_error",
            **kwargs
        )
    
    # Rate limiting logging methods
    def rate_limit_exceeded(
        self,
        identifier: str,
        limit_type: str,
        current_count: int,
        limit: int,
        **kwargs
    ):
        """Log rate limit violations"""
        self._log_with_metadata(
            LogLevel.WARNING,
            f"Rate limit exceeded: {identifier} - {current_count}/{limit} ({limit_type})",
            LogCategory.RATE_LIMIT,
            identifier=identifier,
            limit_type=limit_type,
            current_count=current_count,
            limit=limit,
            rate_limited=True,
            **kwargs
        )
    
    # Cache logging methods
    def cache_hit(self, cache_key: str, ttl_remaining: Optional[int] = None, **kwargs):
        """Log cache hits"""
        self._log_with_metadata(
            LogLevel.DEBUG,
            f"Cache hit: {cache_key}",
            LogCategory.CACHE,
            cache_key=cache_key,
            cache_hit=True,
            ttl_remaining=ttl_remaining,
            **kwargs
        )
    
    def cache_miss(self, cache_key: str, **kwargs):
        """Log cache misses"""
        self._log_with_metadata(
            LogLevel.DEBUG,
            f"Cache miss: {cache_key}",
            LogCategory.CACHE,
            cache_key=cache_key,
            cache_hit=False,
            **kwargs
        )
    
    def cache_error(self, operation: str, error_message: str, **kwargs):
        """Log cache errors"""
        self._log_with_metadata(
            LogLevel.ERROR,
            f"Cache error during {operation}: {error_message}",
            LogCategory.CACHE,
            operation=operation,
            **kwargs
        )
    
    # Performance logging methods
    def performance_metric(
        self,
        operation: str,
        duration_ms: int,
        component: str,
        **kwargs
    ):
        """Log performance metrics"""
        level = LogLevel.WARNING if duration_ms > 5000 else LogLevel.INFO
        self._log_with_metadata(
            level,
            f"Performance: {operation} took {duration_ms}ms in {component}",
            LogCategory.PERFORMANCE,
            operation=operation,
            duration_ms=duration_ms,
            component=component,
            **kwargs
        )
    
    def slow_query(
        self,
        query_type: str,
        duration_ms: int,
        **kwargs
    ):
        """Log slow database queries"""
        self._log_with_metadata(
            LogLevel.WARNING,
            f"Slow query detected: {query_type} took {duration_ms}ms",
            LogCategory.DATABASE,
            query_type=query_type,
            duration_ms=duration_ms,
            **kwargs
        )
    
    # Circuit breaker logging methods
    def circuit_breaker_opened(self, provider: str, failure_count: int, **kwargs):
        """Log circuit breaker opening"""
        self._log_with_metadata(
            LogLevel.ERROR,
            f"Circuit breaker opened for {provider} after {failure_count} failures",
            LogCategory.AI_PROXY,
            provider=provider,
            failure_count=failure_count,
            circuit_state="open",
            **kwargs
        )
    
    def circuit_breaker_closed(self, provider: str, **kwargs):
        """Log circuit breaker closing"""
        self._log_with_metadata(
            LogLevel.INFO,
            f"Circuit breaker closed for {provider}",
            LogCategory.AI_PROXY,
            provider=provider,
            circuit_state="closed",
            **kwargs
        )
    
    # Business logic logging methods
    def business_event(self, event: str, details: Dict[str, Any], **kwargs):
        """Log business logic events"""
        self._log_with_metadata(
            LogLevel.INFO,
            f"Business event: {event}",
            LogCategory.BUSINESS_LOGIC,
            event=event,
            details=details,
            **kwargs
        )
    
    # Standard logging methods with context
    def debug(self, message: str, **kwargs):
        """Debug logging with context"""
        self._log_with_metadata(LogLevel.DEBUG, message, LogCategory.SYSTEM, **kwargs)
    
    def info(self, message: str, **kwargs):
        """Info logging with context"""
        self._log_with_metadata(LogLevel.INFO, message, LogCategory.SYSTEM, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Warning logging with context"""
        self._log_with_metadata(LogLevel.WARNING, message, LogCategory.SYSTEM, **kwargs)
    
    def error(self, message: str, **kwargs):
        """Error logging with context"""
        self._log_with_metadata(LogLevel.ERROR, message, LogCategory.SYSTEM, **kwargs)
    
    def critical(self, message: str, **kwargs):
        """Critical logging with context"""
        self._log_with_metadata(LogLevel.CRITICAL, message, LogCategory.SYSTEM, **kwargs)
    
    def exception(self, message: str, **kwargs):
        """Exception logging with context"""
        # Get current exception info
        exc_info = sys.exc_info()
        if exc_info[0] is not None:
            self.logger.error(
                message, 
                exc_info=exc_info,
                extra={"extra_fields": kwargs}
            )
        else:
            self.error(message, **kwargs)


# Context managers for request tracking
class LoggingContext:
    """Context manager for request-scoped logging"""
    
    def __init__(
        self, 
        request_id: Optional[str] = None,
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ):
        self.request_id = request_id
        self.user_id = user_id
        self.session_id = session_id
        self._tokens = {}
    
    def __enter__(self):
        if self.request_id:
            self._tokens['request_id'] = request_id_context.set(self.request_id)
        if self.user_id:
            self._tokens['user_id'] = user_id_context.set(self.user_id)
        if self.session_id:
            self._tokens['session_id'] = session_id_context.set(self.session_id)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        for token in self._tokens.values():
            token.var.reset(token)


# Factory function
def get_logger(name: str) -> AIProxyLogger:
    """Get or create a logger instance"""
    return AIProxyLogger(name)


# Pre-configured loggers for common components
security_logger = get_logger("ai_proxy.security")
performance_logger = get_logger("ai_proxy.performance")
ai_proxy_logger = get_logger("ai_proxy.service")
cache_logger = get_logger("ai_proxy.cache")
rate_limit_logger = get_logger("ai_proxy.rate_limit")
database_logger = get_logger("ai_proxy.database")


# Decorator for automatic performance logging
def log_performance(component: str, operation: str):
    """Decorator to automatically log performance metrics"""
    def decorator(func: Callable):
        async def async_wrapper(*args, **kwargs):
            start_time = datetime.now()
            logger = get_logger(f"performance.{component}")
            
            try:
                result = await func(*args, **kwargs)
                duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                logger.performance_metric(operation, duration_ms, component)
                return result
            except Exception as e:
                duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                logger.error(
                    f"Operation {operation} failed in {component}",
                    operation=operation,
                    component=component,
                    duration_ms=duration_ms,
                    error=str(e)
                )
                raise
        
        def sync_wrapper(*args, **kwargs):
            start_time = datetime.now()
            logger = get_logger(f"performance.{component}")
            
            try:
                result = func(*args, **kwargs)
                duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                logger.performance_metric(operation, duration_ms, component)
                return result
            except Exception as e:
                duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
                logger.error(
                    f"Operation {operation} failed in {component}",
                    operation=operation,
                    component=component,
                    duration_ms=duration_ms,
                    error=str(e)
                )
                raise
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


# Initialize logging on module import
def initialize_logging():
    """Initialize the logging system"""
    settings = get_settings()
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.log_level.upper(), logging.INFO))
    
    # Suppress noisy third-party loggers in production
    if settings.environment == "production":
        logging.getLogger("httpx").setLevel(logging.WARNING)
        logging.getLogger("urllib3").setLevel(logging.WARNING)
        logging.getLogger("asyncio").setLevel(logging.WARNING)
    
    # Create logs directory
    log_dir = Path(settings.project_root) / "logs"
    log_dir.mkdir(exist_ok=True)


# Initialize on import
initialize_logging()