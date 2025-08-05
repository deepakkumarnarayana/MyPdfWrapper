"""
Simple, Secure HTTP Service for FastAPI

A production-ready HTTP client service that follows 2024 best practices:
- Proper client lifecycle management with lifespan events
- Basic retry logic for timeouts and server errors
- Comprehensive error handling
- Structured logging
- Type hints and async support

Version: 1.0.0
"""

import httpx
import logging
import asyncio
from typing import Optional, Dict, Any, Union
from fastapi import HTTPException
from urllib.parse import urlparse
import ipaddress
import json

from ..config import get_settings

logger = logging.getLogger(__name__)

class HttpService:
    """
    HTTP service for making external API calls with proper error handling and retry logic.
    Uses application configuration for timeouts, retries, and other settings.
    """
    
    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.settings = get_settings()
    
    def _validate_url(self, url: str) -> None:
        """Validate URL for security (prevent SSRF attacks)"""
        if not url or not isinstance(url, str):
            raise ValueError("URL must be a non-empty string")
        
        try:
            parsed = urlparse(url)
        except Exception:
            raise ValueError("Invalid URL format")
        
        # Only allow HTTPS in production, HTTP allowed for localhost in development
        if self.settings.environment == "production" and parsed.scheme != "https":
            raise ValueError("Only HTTPS URLs allowed in production")
        
        if parsed.scheme not in ["http", "https"]:
            raise ValueError("Only HTTP/HTTPS schemes allowed")
        
        # Prevent requests to private/internal IP addresses
        if parsed.hostname:
            try:
                ip = ipaddress.ip_address(parsed.hostname)
                if ip.is_private or ip.is_loopback or ip.is_link_local:
                    if self.settings.environment == "production":
                        raise ValueError("Requests to private IP addresses not allowed in production")
            except ValueError:
                # Not an IP address, check for localhost
                if parsed.hostname.lower() in ["localhost", "127.0.0.1", "::1"]:
                    if self.settings.environment == "production":
                        raise ValueError("Requests to localhost not allowed in production")
        
        # Additional security checks
        if len(url) > 2048:
            raise ValueError("URL too long")
        
        # Block potentially dangerous URLs
        dangerous_patterns = ["file://", "ftp://", "gopher://", "dict://"]
        if any(pattern in url.lower() for pattern in dangerous_patterns):
            raise ValueError("Dangerous URL scheme detected")
    
    def _validate_data(self, data: Optional[Dict]) -> None:
        """Validate request data"""
        if data is None:
            return
        
        if not isinstance(data, dict):
            raise ValueError("Request data must be a dictionary")
        
        # Check data size limit (prevent DoS)
        try:
            serialized = json.dumps(data)
            if len(serialized) > 1024 * 1024:  # 1MB limit
                raise ValueError("Request data too large")
        except (TypeError, ValueError) as e:
            raise ValueError(f"Invalid request data: {e}")
    
    async def _make_request(
        self, 
        method: str, 
        url: str, 
        data: Optional[Dict] = None,
        headers: Optional[Dict] = None,
        retries: Optional[int] = None
    ) -> Dict[Any, Any]:
        """
        Make HTTP request with validation, retry logic and error handling.
        Uses application configuration for retry counts and circuit breaker settings.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: Target URL (validated for security)
            data: Request payload for POST/PUT requests (validated)
            headers: Additional headers
            retries: Number of retry attempts (uses config default if None)
            
        Returns:
            Response data as dictionary
            
        Raises:
            HTTPException: For various error conditions
            ValueError: For validation errors
        """
        
        # Validate inputs for security
        self._validate_url(url)
        self._validate_data(data)
        
        if method.upper() not in ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        # Use config settings for retries if not specified.
        # Default to the circuit breaker's failure threshold for retries.
        default_retries = self.settings.circuit_breaker_failure_threshold
        max_retries = retries if retries is not None else default_retries

        # Use fewer retries for state-changing operations to avoid duplication.
        if method.upper() in ['POST', 'PUT', 'PATCH', 'DELETE']:
            max_retries = min(max_retries, 1)
            
        merged_headers = {**(headers or {})}
        
        for attempt in range(max_retries + 1):
            try:
                if method.upper() == "GET":
                    response = await self.client.get(url, headers=merged_headers)
                elif method.upper() == "POST":
                    response = await self.client.post(url, json=data, headers=merged_headers)
                elif method.upper() == "PUT":
                    response = await self.client.put(url, json=data, headers=merged_headers)
                elif method.upper() == "DELETE":
                    response = await self.client.delete(url, headers=merged_headers)
                elif method.upper() == "PATCH":
                    response = await self.client.patch(url, json=data, headers=merged_headers)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                response.raise_for_status()
                
                # Handle different content types
                content_type = response.headers.get('content-type', '')
                if 'application/json' in content_type:
                    return response.json()
                else:
                    return {
                        "content": response.text, 
                        "status_code": response.status_code,
                        "content_type": content_type
                    }
                    
            except httpx.TimeoutException as e:
                logger.warning(f"Timeout on attempt {attempt + 1} for {method} {url}")
                if attempt == max_retries:
                    raise HTTPException(
                        status_code=408, 
                        detail=f"Request timeout after {max_retries + 1} attempts"
                    )
                await asyncio.sleep(0.5 * (attempt + 1))  # Exponential backoff
                
            except httpx.HTTPStatusError as e:
                logger.warning(f"HTTP {e.response.status_code} for {method} {url}")
                
                # Retry only on server errors (5xx), not client errors (4xx)
                if e.response.status_code >= 500 and attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                    
                # Different handling for different status codes
                if e.response.status_code == 404:
                    raise HTTPException(
                        status_code=404,
                        detail="External resource not found"
                    )
                elif e.response.status_code == 429:
                    raise HTTPException(
                        status_code=429,
                        detail="External API rate limit exceeded"
                    )
                else:
                    raise HTTPException(
                        status_code=e.response.status_code,
                        detail=f"External API error: {e.response.status_code}"
                    )
                
            except httpx.RequestError as e:
                logger.error(f"Request error for {method} {url}: {str(e)}")
                if attempt < max_retries:
                    await asyncio.sleep(0.5 * (attempt + 1))
                    continue
                raise HTTPException(
                    status_code=500, 
                    detail="External service unavailable"
                )
                
            except Exception as e:
                logger.error(f"Unexpected error calling {method} {url}: {str(e)}")
                raise HTTPException(
                    status_code=500, 
                    detail="Internal server error during external API call"
                )
    
    async def get(
        self, 
        url: str, 
        headers: Optional[Dict] = None,
        retries: Optional[int] = None
    ) -> Dict[Any, Any]:
        """Make GET request."""
        return await self._make_request("GET", url, headers=headers, retries=retries)
    
    async def post(
        self, 
        url: str, 
        data: Optional[Dict] = None, 
        headers: Optional[Dict] = None,
        retries: Optional[int] = None
    ) -> Dict[Any, Any]:
        """Make POST request."""
        return await self._make_request("POST", url, data=data, headers=headers, retries=retries)
    
    async def put(
        self, 
        url: str, 
        data: Optional[Dict] = None, 
        headers: Optional[Dict] = None,
        retries: Optional[int] = None
    ) -> Dict[Any, Any]:
        """Make PUT request."""
        return await self._make_request("PUT", url, data=data, headers=headers, retries=retries)
    
    async def delete(
        self, 
        url: str, 
        headers: Optional[Dict] = None,
        retries: Optional[int] = None
    ) -> Dict[Any, Any]:
        """Make DELETE request."""
        return await self._make_request("DELETE", url, headers=headers, retries=retries)
    
    async def patch(
        self, 
        url: str, 
        data: Optional[Dict] = None, 
        headers: Optional[Dict] = None,
        retries: Optional[int] = None
    ) -> Dict[Any, Any]:
        """Make PATCH request."""
        return await self._make_request("PATCH", url, data=data, headers=headers, retries=retries)

# Global HTTP client instance - will be initialized in main.py
http_client: Optional[httpx.AsyncClient] = None

def get_http_service() -> HttpService:
    """
    Dependency function to get HTTP service instance.
    
    Returns:
        HttpService: Configured HTTP service instance
        
    Raises:
        RuntimeError: If HTTP client is not initialized
    """
    if http_client is None:
        raise RuntimeError("HTTP client not initialized. Make sure to use lifespan events in main.py")
    
    return HttpService(http_client)

# Convenience functions for direct use
async def make_get_request(url: str, headers: Optional[Dict] = None) -> Dict[Any, Any]:
    """Make a GET request using the global HTTP service."""
    service = get_http_service()
    return await service.get(url, headers=headers)

async def make_post_request(
    url: str, 
    data: Optional[Dict] = None, 
    headers: Optional[Dict] = None
) -> Dict[Any, Any]:
    """Make a POST request using the global HTTP service."""
    service = get_http_service()
    return await service.post(url, data=data, headers=headers)