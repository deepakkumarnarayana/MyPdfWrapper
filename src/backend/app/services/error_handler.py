"""
Comprehensive Error Handling Service for AI Proxy Operations
Production-ready error handling with classification, recovery, and monitoring.
"""

import asyncio
import traceback
from datetime import datetime, timedelta
from enum import Enum
from typing import Dict, Any, Optional, List, Type, Callable, Union
from dataclasses import dataclass
from contextlib import asynccontextmanager
import json

from fastapi import HTTPException, Request, Response
from fastapi.responses import JSONResponse
from starlette.status import *
from redis.exceptions import ConnectionError as RedisConnectionError, TimeoutError as RedisTimeoutError
from anthropic import APIError as AnthropicAPIError
from openai import APIError as OpenAIAPIError

from app.services.logging_service import get_logger, LoggingContext
from app.config import get_settings

logger = get_logger("ai_proxy.error_handler")
settings = get_settings()


class ErrorCategory(Enum):
    """Error categories for classification and handling"""
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    RATE_LIMIT = "rate_limit"
    QUOTA_EXCEEDED = "quota_exceeded"
    PROVIDER_ERROR = "provider_error"
    NETWORK_ERROR = "network_error"
    TIMEOUT = "timeout"
    CIRCUIT_BREAKER = "circuit_breaker"
    CACHE_ERROR = "cache_error"
    DATABASE_ERROR = "database_error"
    SECURITY_VIOLATION = "security_violation"
    INTERNAL_ERROR = "internal_error"
    CONFIGURATION_ERROR = "configuration_error"
    RESOURCE_EXHAUSTED = "resource_exhausted"


class ErrorSeverity(Enum):
    """Error severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class ErrorContext:
    """Comprehensive error context information"""
    category: ErrorCategory
    severity: ErrorSeverity
    message: str
    details: Optional[Dict[str, Any]] = None
    user_message: Optional[str] = None
    recovery_suggestions: Optional[List[str]] = None
    retry_after: Optional[int] = None
    should_log: bool = True
    should_alert: bool = False
    status_code: int = HTTP_500_INTERNAL_SERVER_ERROR
    error_code: Optional[str] = None
    provider: Optional[str] = None
    operation: Optional[str] = None
    request_id: Optional[str] = None
    user_id: Optional[int] = None
    client_ip: Optional[str] = None


class ErrorClassifier:
    """Classifies exceptions into standardized error contexts"""
    
    def __init__(self):
        self.classification_rules = self._build_classification_rules()
    
    def _build_classification_rules(self) -> Dict[Type[Exception], Callable]:
        """Build exception classification rules"""
        return {
            # HTTP Exceptions
            HTTPException: self._classify_http_exception,
            
            # AI Provider Exceptions
            AnthropicAPIError: self._classify_anthropic_error,
            OpenAIAPIError: self._classify_openai_error,
            
            # Network/Connection Exceptions
            RedisConnectionError: self._classify_redis_connection_error,
            RedisTimeoutError: self._classify_redis_timeout_error,
            ConnectionError: self._classify_connection_error,
            TimeoutError: self._classify_timeout_error,
            asyncio.TimeoutError: self._classify_timeout_error,
            
            # Standard Python Exceptions
            ValueError: self._classify_value_error,
            KeyError: self._classify_key_error,
            PermissionError: self._classify_permission_error,
            FileNotFoundError: self._classify_file_not_found,
            
            # Catch-all
            Exception: self._classify_generic_exception
        }
    
    def classify(self, exception: Exception, **context) -> ErrorContext:
        """Classify an exception into an ErrorContext"""
        
        # Find the most specific classification rule
        for exception_type in type(exception).mro():
            if exception_type in self.classification_rules:
                classifier = self.classification_rules[exception_type]
                return classifier(exception, **context)
        
        # Fallback to generic classification
        return self._classify_generic_exception(exception, **context)
    
    def _classify_http_exception(self, exc: HTTPException, **context) -> ErrorContext:
        """Classify HTTP exceptions"""
        if exc.status_code == HTTP_400_BAD_REQUEST:
            return ErrorContext(
                category=ErrorCategory.VALIDATION,
                severity=ErrorSeverity.LOW,
                message=str(exc.detail),
                user_message="Invalid request format or parameters",
                status_code=exc.status_code,
                error_code="VALIDATION_ERROR"
            )
        elif exc.status_code == HTTP_401_UNAUTHORIZED:
            return ErrorContext(
                category=ErrorCategory.AUTHENTICATION,
                severity=ErrorSeverity.MEDIUM,
                message="Authentication required",
                user_message="Authentication required to access this resource",
                status_code=exc.status_code,
                error_code="AUTH_REQUIRED"
            )
        elif exc.status_code == HTTP_403_FORBIDDEN:
            return ErrorContext(
                category=ErrorCategory.AUTHORIZATION,
                severity=ErrorSeverity.MEDIUM,
                message="Access forbidden",
                user_message="You don't have permission to access this resource",
                status_code=exc.status_code,
                error_code="ACCESS_FORBIDDEN"
            )
        elif exc.status_code == HTTP_429_TOO_MANY_REQUESTS:
            return ErrorContext(
                category=ErrorCategory.RATE_LIMIT,
                severity=ErrorSeverity.MEDIUM,
                message="Rate limit exceeded",
                user_message="Too many requests. Please slow down.",
                status_code=exc.status_code,
                error_code="RATE_LIMIT_EXCEEDED",
                retry_after=60
            )
        else:
            return ErrorContext(
                category=ErrorCategory.INTERNAL_ERROR,
                severity=ErrorSeverity.HIGH,
                message=str(exc.detail),
                status_code=exc.status_code,
                error_code="HTTP_ERROR"
            )
    
    def _classify_anthropic_error(self, exc: AnthropicAPIError, **context) -> ErrorContext:
        """Classify Anthropic API errors"""
        error_message = str(exc)
        status_code = getattr(exc, 'status_code', 500)
        
        if status_code == 401:
            return ErrorContext(
                category=ErrorCategory.AUTHENTICATION,
                severity=ErrorSeverity.HIGH,
                message="Claude API authentication failed",
                user_message="AI service authentication error",
                status_code=HTTP_503_SERVICE_UNAVAILABLE,
                error_code="CLAUDE_AUTH_ERROR",
                provider="claude",
                should_alert=True
            )
        elif status_code == 429:
            return ErrorContext(
                category=ErrorCategory.RATE_LIMIT,
                severity=ErrorSeverity.MEDIUM,
                message="Claude API rate limit exceeded",
                user_message="AI service is temporarily unavailable due to high demand",
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                error_code="CLAUDE_RATE_LIMIT",
                provider="claude",
                retry_after=60
            )
        elif status_code >= 500:
            return ErrorContext(
                category=ErrorCategory.PROVIDER_ERROR,
                severity=ErrorSeverity.HIGH,
                message=f"Claude API server error: {error_message}",
                user_message="AI service is temporarily unavailable",
                status_code=HTTP_503_SERVICE_UNAVAILABLE,
                error_code="CLAUDE_SERVER_ERROR",
                provider="claude",
                should_alert=True
            )
        else:
            return ErrorContext(
                category=ErrorCategory.PROVIDER_ERROR,
                severity=ErrorSeverity.MEDIUM,
                message=f"Claude API error: {error_message}",
                user_message="AI request failed due to service error",
                status_code=HTTP_502_BAD_GATEWAY,
                error_code="CLAUDE_API_ERROR",
                provider="claude"
            )
    
    def _classify_openai_error(self, exc: OpenAIAPIError, **context) -> ErrorContext:
        """Classify OpenAI API errors"""
        error_message = str(exc)
        status_code = getattr(exc, 'status_code', 500)
        
        if status_code == 401:
            return ErrorContext(
                category=ErrorCategory.AUTHENTICATION,
                severity=ErrorSeverity.HIGH,
                message="OpenAI API authentication failed",
                user_message="AI service authentication error",
                status_code=HTTP_503_SERVICE_UNAVAILABLE,
                error_code="OPENAI_AUTH_ERROR",
                provider="openai",
                should_alert=True
            )
        elif status_code == 429:
            return ErrorContext(
                category=ErrorCategory.RATE_LIMIT,
                severity=ErrorSeverity.MEDIUM,
                message="OpenAI API rate limit exceeded",
                user_message="AI service is temporarily unavailable due to high demand",
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                error_code="OPENAI_RATE_LIMIT",
                provider="openai",
                retry_after=60
            )
        else:
            return ErrorContext(
                category=ErrorCategory.PROVIDER_ERROR,
                severity=ErrorSeverity.MEDIUM,
                message=f"OpenAI API error: {error_message}",
                user_message="AI request failed due to service error",
                status_code=HTTP_502_BAD_GATEWAY,
                error_code="OPENAI_API_ERROR",
                provider="openai"
            )
    
    def _classify_redis_connection_error(self, exc: Exception, **context) -> ErrorContext:
        """Classify Redis connection errors"""
        return ErrorContext(
            category=ErrorCategory.CACHE_ERROR,
            severity=ErrorSeverity.MEDIUM,
            message=f"Redis connection failed: {exc}",
            user_message="Caching service temporarily unavailable",
            status_code=HTTP_503_SERVICE_UNAVAILABLE,
            error_code="REDIS_CONNECTION_ERROR",
            should_alert=True
        )
    
    def _classify_redis_timeout_error(self, exc: Exception, **context) -> ErrorContext:
        """Classify Redis timeout errors"""
        return ErrorContext(
            category=ErrorCategory.TIMEOUT,
            severity=ErrorSeverity.MEDIUM,
            message=f"Redis operation timeout: {exc}",
            user_message="Request timeout - please try again",
            status_code=HTTP_504_GATEWAY_TIMEOUT,
            error_code="REDIS_TIMEOUT",
            retry_after=5
        )
    
    def _classify_connection_error(self, exc: Exception, **context) -> ErrorContext:
        """Classify general connection errors"""
        return ErrorContext(
            category=ErrorCategory.NETWORK_ERROR,
            severity=ErrorSeverity.HIGH,
            message=f"Network connection failed: {exc}",
            user_message="Service temporarily unavailable",
            status_code=HTTP_503_SERVICE_UNAVAILABLE,
            error_code="CONNECTION_ERROR",
            should_alert=True
        )
    
    def _classify_timeout_error(self, exc: Exception, **context) -> ErrorContext:
        """Classify timeout errors"""
        return ErrorContext(
            category=ErrorCategory.TIMEOUT,
            severity=ErrorSeverity.MEDIUM,
            message=f"Operation timeout: {exc}",
            user_message="Request timeout - please try again",
            status_code=HTTP_504_GATEWAY_TIMEOUT,
            error_code="TIMEOUT_ERROR",
            retry_after=10
        )
    
    def _classify_value_error(self, exc: ValueError, **context) -> ErrorContext:
        """Classify value errors"""
        return ErrorContext(
            category=ErrorCategory.VALIDATION,
            severity=ErrorSeverity.LOW,
            message=f"Validation error: {exc}",
            user_message="Invalid input provided",
            status_code=HTTP_400_BAD_REQUEST,
            error_code="VALIDATION_ERROR"
        )
    
    def _classify_key_error(self, exc: KeyError, **context) -> ErrorContext:
        """Classify key errors"""
        return ErrorContext(
            category=ErrorCategory.VALIDATION,
            severity=ErrorSeverity.LOW,
            message=f"Missing required field: {exc}",
            user_message="Required field missing from request",
            status_code=HTTP_400_BAD_REQUEST,
            error_code="MISSING_FIELD"
        )
    
    def _classify_permission_error(self, exc: PermissionError, **context) -> ErrorContext:
        """Classify permission errors"""
        return ErrorContext(
            category=ErrorCategory.AUTHORIZATION,
            severity=ErrorSeverity.HIGH,
            message=f"Permission denied: {exc}",
            user_message="Access denied",
            status_code=HTTP_403_FORBIDDEN,
            error_code="PERMISSION_DENIED",
            should_alert=True
        )
    
    def _classify_file_not_found(self, exc: FileNotFoundError, **context) -> ErrorContext:
        """Classify file not found errors"""
        return ErrorContext(
            category=ErrorCategory.CONFIGURATION_ERROR,
            severity=ErrorSeverity.HIGH,
            message=f"Required file not found: {exc}",
            user_message="Service configuration error",
            status_code=HTTP_503_SERVICE_UNAVAILABLE,
            error_code="FILE_NOT_FOUND",
            should_alert=True
        )
    
    def _classify_generic_exception(self, exc: Exception, **context) -> ErrorContext:
        """Classify generic exceptions"""
        return ErrorContext(
            category=ErrorCategory.INTERNAL_ERROR,
            severity=ErrorSeverity.HIGH,
            message=f"Unexpected error: {type(exc).__name__}: {exc}",
            user_message="An unexpected error occurred",
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            error_code="INTERNAL_ERROR",
            should_alert=True
        )


class ErrorRecoveryManager:
    """Manages error recovery strategies"""
    
    def __init__(self):
        self.recovery_strategies = {
            ErrorCategory.RATE_LIMIT: self._recover_rate_limit,
            ErrorCategory.TIMEOUT: self._recover_timeout,
            ErrorCategory.NETWORK_ERROR: self._recover_network_error,
            ErrorCategory.CACHE_ERROR: self._recover_cache_error,
            ErrorCategory.PROVIDER_ERROR: self._recover_provider_error,
        }
    
    async def attempt_recovery(self, error_context: ErrorContext) -> Optional[Dict[str, Any]]:
        """Attempt to recover from an error"""
        if error_context.category in self.recovery_strategies:
            strategy = self.recovery_strategies[error_context.category]
            return await strategy(error_context)
        return None
    
    async def _recover_rate_limit(self, error_context: ErrorContext) -> Dict[str, Any]:
        """Recovery strategy for rate limit errors"""
        return {
            "recovery_type": "backoff",
            "retry_after": error_context.retry_after or 60,
            "suggestions": [
                "Reduce request frequency",
                "Implement client-side rate limiting",
                "Consider upgrading service tier"
            ]
        }
    
    async def _recover_timeout(self, error_context: ErrorContext) -> Dict[str, Any]:
        """Recovery strategy for timeout errors"""
        return {
            "recovery_type": "retry",
            "retry_after": error_context.retry_after or 5,
            "max_retries": 3,
            "suggestions": [
                "Retry with exponential backoff",
                "Reduce request complexity",
                "Check network connectivity"
            ]
        }
    
    async def _recover_network_error(self, error_context: ErrorContext) -> Dict[str, Any]:
        """Recovery strategy for network errors"""
        return {
            "recovery_type": "circuit_breaker",
            "retry_after": 30,
            "suggestions": [
                "Check service health",
                "Verify network connectivity",
                "Consider fallback service"
            ]
        }
    
    async def _recover_cache_error(self, error_context: ErrorContext) -> Dict[str, Any]:
        """Recovery strategy for cache errors"""
        return {
            "recovery_type": "fallback",
            "fallback_strategy": "direct_computation",
            "suggestions": [
                "Operation will continue without caching",
                "Check Redis service health",
                "Consider cache service restart"
            ]
        }
    
    async def _recover_provider_error(self, error_context: ErrorContext) -> Dict[str, Any]:
        """Recovery strategy for AI provider errors"""
        return {
            "recovery_type": "failover",
            "suggestions": [
                "Try alternative AI provider",
                "Check service status page",
                "Verify API credentials"
            ]
        }


class AIProxyErrorHandler:
    """Comprehensive error handler for AI Proxy operations"""
    
    def __init__(self):
        self.classifier = ErrorClassifier()
        self.recovery_manager = ErrorRecoveryManager()
        self.logger = get_logger("ai_proxy.error_handler")
        
        # Error tracking for alerting
        self.error_counts = {}
        self.last_alert_time = {}
    
    async def handle_exception(
        self, 
        exception: Exception,
        request: Optional[Request] = None,
        **context
    ) -> JSONResponse:
        """Handle an exception and return appropriate response"""
        
        # Extract request context if available
        if request:
            context.update({
                'request_id': request.headers.get('x-request-id'),
                'client_ip': request.client.host if request.client else None,
                'user_agent': request.headers.get('user-agent'),
                'path': str(request.url.path),
                'method': request.method
            })
        
        # Classify the error
        error_context = self.classifier.classify(exception, **context)
        
        # Add context information
        error_context.request_id = context.get('request_id')
        error_context.user_id = context.get('user_id')
        error_context.client_ip = context.get('client_ip')
        error_context.operation = context.get('operation')
        error_context.provider = context.get('provider')
        
        # Log the error
        if error_context.should_log:
            await self._log_error(error_context, exception)
        
        # Track error for alerting
        if error_context.should_alert:
            await self._track_error_for_alerting(error_context)
        
        # Attempt recovery
        recovery_info = await self.recovery_manager.attempt_recovery(error_context)
        
        # Build response
        response_data = {
            "error": True,
            "error_code": error_context.error_code,
            "message": error_context.user_message or "An error occurred",
            "category": error_context.category.value,
            "severity": error_context.severity.value,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        # Add request ID for tracing
        if error_context.request_id:
            response_data["request_id"] = error_context.request_id
        
        # Add retry information
        if error_context.retry_after:
            response_data["retry_after"] = error_context.retry_after
        
        # Add recovery information
        if recovery_info:
            response_data["recovery"] = recovery_info
        
        # Add details in development
        if settings.debug and error_context.details:
            response_data["details"] = error_context.details
        
        # Build headers
        headers = {}
        if error_context.retry_after:
            headers["Retry-After"] = str(error_context.retry_after)
        
        return JSONResponse(
            status_code=error_context.status_code,
            content=response_data,
            headers=headers
        )
    
    async def _log_error(self, error_context: ErrorContext, exception: Exception):
        """Log error with appropriate level and context"""
        
        log_data = {
            "category": error_context.category.value,
            "severity": error_context.severity.value,
            "error_code": error_context.error_code,
            "status_code": error_context.status_code,
            "provider": error_context.provider,
            "operation": error_context.operation,
            "client_ip": error_context.client_ip,
            "exception_type": type(exception).__name__,
            "traceback": traceback.format_exc() if settings.debug else None
        }
        
        if error_context.severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
            self.logger.error(error_context.message, **log_data)
        elif error_context.severity == ErrorSeverity.MEDIUM:
            self.logger.warning(error_context.message, **log_data)
        else:
            self.logger.info(error_context.message, **log_data)
    
    async def _track_error_for_alerting(self, error_context: ErrorContext):
        """Track errors for alerting thresholds"""
        
        error_key = f"{error_context.category.value}:{error_context.error_code}"
        current_time = datetime.utcnow()
        
        # Initialize tracking
        if error_key not in self.error_counts:
            self.error_counts[error_key] = []
            self.last_alert_time[error_key] = None
        
        # Add current error
        self.error_counts[error_key].append(current_time)
        
        # Clean old errors (last hour)
        cutoff_time = current_time - timedelta(hours=1)
        self.error_counts[error_key] = [
            error_time for error_time in self.error_counts[error_key]
            if error_time > cutoff_time
        ]
        
        # Check if alert threshold reached
        error_count = len(self.error_counts[error_key])
        alert_threshold = self._get_alert_threshold(error_context.severity)
        
        # Check if we should send alert
        should_alert = (
            error_count >= alert_threshold and
            (
                self.last_alert_time[error_key] is None or
                current_time - self.last_alert_time[error_key] > timedelta(minutes=15)
            )
        )
        
        if should_alert:
            await self._send_alert(error_context, error_count)
            self.last_alert_time[error_key] = current_time
    
    def _get_alert_threshold(self, severity: ErrorSeverity) -> int:
        """Get alert threshold based on severity"""
        thresholds = {
            ErrorSeverity.LOW: 50,
            ErrorSeverity.MEDIUM: 20,
            ErrorSeverity.HIGH: 10,
            ErrorSeverity.CRITICAL: 3
        }
        return thresholds.get(severity, 10)
    
    async def _send_alert(self, error_context: ErrorContext, error_count: int):
        """Send alert for error threshold breach"""
        
        alert_data = {
            "alert_type": "error_threshold_exceeded",
            "category": error_context.category.value,
            "severity": error_context.severity.value,
            "error_code": error_context.error_code,
            "count": error_count,
            "time_window": "1 hour",
            "provider": error_context.provider,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Log critical alert
        self.logger.critical(
            f"Error threshold exceeded: {error_context.category.value} - {error_count} errors in 1 hour",
            **alert_data
        )
        
        # Here you would integrate with your alerting system
        # Examples: Slack, PagerDuty, email, etc.
    
    @asynccontextmanager
    async def handle_errors(self, request: Optional[Request] = None, **context):
        """Context manager for automatic error handling"""
        try:
            yield
        except Exception as e:
            response = await self.handle_exception(e, request, **context)
            raise HTTPException(
                status_code=response.status_code,
                detail=json.loads(response.body.decode())
            )


# Global error handler instance
error_handler = AIProxyErrorHandler()


# Decorator for automatic error handling
def handle_errors(operation: str = None, provider: str = None):
    """Decorator for automatic error handling"""
    def decorator(func: Callable):
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                context = {
                    'operation': operation,
                    'provider': provider,
                    'function': func.__name__
                }
                
                # Try to extract request from args if it's a FastAPI endpoint
                request = None
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
                
                response = await error_handler.handle_exception(e, request, **context)
                raise HTTPException(
                    status_code=response.status_code,
                    detail=json.loads(response.body.decode())
                )
        
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # For sync functions, we can't use the async error handler
                # So we'll just log and re-raise
                logger.error(f"Error in {func.__name__}: {e}", operation=operation, provider=provider)
                raise
        
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator