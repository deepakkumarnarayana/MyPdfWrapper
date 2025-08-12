"""
Security Utilities

Provides security validation, event logging, and monitoring utilities
for the PDF proxy service.
"""

import hashlib
import logging
import json
from datetime import datetime
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class SecurityValidator:
    """Security validation utilities"""
    
    @staticmethod
    def is_safe_filename(filename: str) -> bool:
        """Validate filename for security"""
        if not filename:
            return False
        
        # Check for directory traversal attempts
        dangerous_patterns = ['..', '/', '\\', '<', '>', ':', '"', '|', '?', '*']
        if any(pattern in filename for pattern in dangerous_patterns):
            return False
        
        # Must end with .pdf
        if not filename.lower().endswith('.pdf'):
            return False
        
        return True
    
    @staticmethod
    def generate_secure_hash(data: bytes) -> str:
        """Generate secure hash of data"""
        return hashlib.sha256(data).hexdigest()
    
    @staticmethod
    def validate_content_length(length: int, max_size: int) -> bool:
        """Validate content length"""
        return 0 < length <= max_size


async def log_security_event(event_type: str, details: Dict[str, Any]) -> None:
    """
    Log security events for monitoring and alerting.
    
    Args:
        event_type: Type of security event
        details: Event details and context
    """
    try:
        event_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'event_type': event_type,
            'details': details,
            'severity': _get_event_severity(event_type)
        }
        
        # Log to application logger
        logger.info(f"SECURITY_EVENT: {json.dumps(event_data)}")
        
        # Here you would typically send to your monitoring system:
        # - Elasticsearch/Kibana
        # - Splunk
        # - Datadog
        # - CloudWatch
        # - Custom SIEM
        
        # Example: Send to monitoring system
        # await send_to_monitoring_system(event_data)
        
    except Exception as e:
        logger.error(f"Failed to log security event: {e}")


def _get_event_severity(event_type: str) -> str:
    """Determine severity level for security events"""
    high_severity_events = [
        'pdf_javascript_detected',
        'pdf_invalid_url_blocked', 
        'pdf_rate_limit_exceeded',
        'pdf_proxy_error'
    ]
    
    medium_severity_events = [
        'pdf_cache_miss',
        'pdf_fetch_timeout'
    ]
    
    if event_type in high_severity_events:
        return 'HIGH'
    elif event_type in medium_severity_events:
        return 'MEDIUM'
    else:
        return 'LOW'


class SecurityHeaders:
    """Security HTTP headers for PDF responses"""
    
    @staticmethod
    def get_pdf_security_headers() -> Dict[str, str]:
        """Get comprehensive security headers for PDF responses"""
        return {
            # Content Security Policy - strict for PDF viewing
            "Content-Security-Policy": (
                "default-src 'none'; "
                "frame-ancestors 'none'; "
                "base-uri 'none'; "
                "form-action 'none';"
            ),
            
            # Prevent MIME type sniffing
            "X-Content-Type-Options": "nosniff",
            
            # Prevent clickjacking
            "X-Frame-Options": "DENY",
            
            # XSS Protection
            "X-XSS-Protection": "1; mode=block",
            
            # Referrer Policy
            "Referrer-Policy": "no-referrer",
            
            # Permissions Policy
            "Permissions-Policy": (
                "camera=(), "
                "microphone=(), "
                "geolocation=(), "
                "payment=(), "
                "usb=(), "
                "magnetometer=(), "
                "gyroscope=(), "
                "accelerometer=()"
            )
        }
    
    @staticmethod
    def get_cache_headers(max_age: int = 3600) -> Dict[str, str]:
        """Get caching headers for PDF responses"""
        return {
            "Cache-Control": f"private, max-age={max_age}, stale-while-revalidate={max_age * 24}",
            "Vary": "Accept-Encoding, Authorization"
        }