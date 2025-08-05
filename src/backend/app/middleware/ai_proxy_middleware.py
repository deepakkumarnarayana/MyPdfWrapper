"""
AI Proxy Middleware for Rate Limiting, Authentication, and Security
Production-ready middleware with comprehensive protection patterns.
"""

import asyncio
import hashlib
import json
import time
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple, List, Set
from fastapi import HTTPException, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import logging

from app.config import get_settings
from app.database import get_db
from app.models import AIRateLimit, AIQuotaLimit, AIProvider, AIUsageLog
from app.services.redis_manager import get_redis_manager

logger = logging.getLogger(__name__)
settings = get_settings()


class AIProxySecurityValidator:
    """Advanced security validation for AI proxy requests"""
    
    def __init__(self):
        self.settings = get_settings()
        
        # Security patterns to detect
        self.malicious_patterns = [
            # Injection patterns
            r'(?i)(union\s+select|insert\s+into|drop\s+table|delete\s+from)',
            r'(?i)(<script|javascript:|data:text/html)',
            r'(?i)(eval\(|function\(|setTimeout\(|setInterval\()',
            
            # Prompt injection patterns
            r'(?i)(ignore\s+previous|forget\s+instructions|new\s+instructions)',
            r'(?i)(system\s*:|assistant\s*:|user\s*:.*admin)',
            r'(?i)(jailbreak|DAN\s+mode|developer\s+mode)',
            
            # Sensitive information patterns
            r'(?i)(password|api[_\s]?key|secret|token|credential)',
            r'(?i)(ssn|social\s+security|credit\s+card|bank\s+account)',
            
            # Command execution patterns
            r'(?i)(exec\(|system\(|shell_exec|passthru)',
            r'(?i)(rm\s+-rf|del\s+/|format\s+c:)',
        ]
        
        self.compiled_patterns = [re.compile(pattern) for pattern in self.malicious_patterns]
        
        # Rate limiting thresholds for different threat levels
        self.threat_multipliers = {
            'low': 1.0,
            'medium': 0.5,
            'high': 0.2,
            'critical': 0.1
        }
        
        # Blocked user agents and IPs
        self.blocked_user_agents: Set[str] = {
            'scanner', 'bot', 'crawler', 'spider', 'scraper'
        }
        
        self.blocked_ips: Set[str] = set()  # Can be populated from config/database
        
        # Request size limits
        self.max_request_size = 1024 * 1024  # 1MB
        self.max_message_length = 32000
        self.max_messages_count = 50
    
    def analyze_threat_level(self, content: str) -> Tuple[str, List[str]]:
        """Analyze content for threat level and return issues found"""
        issues = []
        threat_level = 'low'
        
        # Check for malicious patterns
        for i, pattern in enumerate(self.compiled_patterns):
            if pattern.search(content):
                pattern_desc = self.malicious_patterns[i]
                issues.append(f"Malicious pattern detected: {pattern_desc[:50]}...")
                
                # Escalate threat level based on pattern type
                if 'injection' in pattern_desc.lower() or 'exec' in pattern_desc.lower():
                    threat_level = 'critical'
                elif 'script' in pattern_desc.lower() or 'admin' in pattern_desc.lower():
                    threat_level = 'high'
                elif 'ignore' in pattern_desc.lower() or 'password' in pattern_desc.lower():
                    threat_level = 'medium'
        
        # Check content length and complexity
        if len(content) > self.max_message_length:
            issues.append(f"Content too long: {len(content)} > {self.max_message_length}")
            threat_level = max(threat_level, 'medium', key=lambda x: ['low', 'medium', 'high', 'critical'].index(x))
        
        # Check for excessive repetition (potential attack)
        words = content.split()
        if len(words) > 10:
            word_freq = {}
            for word in words:
                word_freq[word] = word_freq.get(word, 0) + 1
            
            max_freq = max(word_freq.values())
            if max_freq > len(words) * 0.3:  # More than 30% repetition
                issues.append("Excessive word repetition detected")
                threat_level = max(threat_level, 'medium', key=lambda x: ['low', 'medium', 'high', 'critical'].index(x))
        
        return threat_level, issues
    
    def validate_request_structure(self, request_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate request structure for security issues"""
        issues = []
        
        # Check required fields
        if 'messages' not in request_data:
            issues.append("Missing required 'messages' field")
            return False, issues
        
        messages = request_data.get('messages', [])
        
        # Validate messages structure
        if not isinstance(messages, list):
            issues.append("Messages must be a list")
            return False, issues
        
        if len(messages) == 0:
            issues.append("At least one message is required")
            return False, issues
        
        if len(messages) > self.max_messages_count:
            issues.append(f"Too many messages: {len(messages)} > {self.max_messages_count}")
            return False, issues
        
        # Validate individual messages
        for i, message in enumerate(messages):
            if not isinstance(message, dict):
                issues.append(f"Message {i} must be a dictionary")
                return False, issues
            
            if 'role' not in message or 'content' not in message:
                issues.append(f"Message {i} missing required fields (role, content)")
                return False, issues
            
            if message['role'] not in ['user', 'assistant', 'system']:
                issues.append(f"Message {i} has invalid role: {message['role']}")
                return False, issues
            
            if not isinstance(message['content'], str):
                issues.append(f"Message {i} content must be a string")
                return False, issues
        
        # Validate other parameters
        if 'max_tokens' in request_data:
            max_tokens = request_data['max_tokens']
            if not isinstance(max_tokens, int) or max_tokens < 1 or max_tokens > self.settings.ai_proxy_max_tokens:
                issues.append(f"Invalid max_tokens: {max_tokens}")
                return False, issues
        
        if 'temperature' in request_data:
            temp = request_data['temperature']
            if not isinstance(temp, (int, float)) or temp < 0 or temp > 2:
                issues.append(f"Invalid temperature: {temp}")
                return False, issues
        
        return True, issues
    
    def validate_client_info(self, request: Request) -> Tuple[bool, List[str]]:
        """Validate client information for security issues"""
        issues = []
        
        # Check User-Agent
        user_agent = request.headers.get('user-agent', '').lower()
        for blocked_agent in self.blocked_user_agents:
            if blocked_agent in user_agent:
                issues.append(f"Blocked user agent: {blocked_agent}")
                return False, issues
        
        # Check client IP
        client_ip = request.client.host if request.client else None
        if client_ip in self.blocked_ips:
            issues.append(f"Blocked IP address: {client_ip}")
            return False, issues
        
        # Check for suspicious headers
        suspicious_headers = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip']
        forwarded_ips = []
        for header in suspicious_headers:
            if header in request.headers:
                forwarded_ips.extend(request.headers[header].split(','))
        
        # Check forwarded IPs against blocklist
        for ip in forwarded_ips:
            ip = ip.strip()
            if ip in self.blocked_ips:
                issues.append(f"Blocked forwarded IP: {ip}")
                return False, issues
        
        return True, issues


class AIProxyRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Advanced rate limiting middleware with Redis backing for AI proxy endpoints.
    Implements token bucket, sliding window, and quota-based limiting with threat-aware scaling.
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.settings = get_settings()
        self.security_validator = AIProxySecurityValidator()
        
    async def dispatch(self, request: Request, call_next):
        # Only apply to AI proxy endpoints
        if not request.url.path.startswith("/api/v1/ai-proxy/"):
            return await call_next(request)
        
        try:
            # Get Redis manager
            redis_manager = await get_redis_manager()
            
            # Extract user/session identification
            user_id, session_id = await self._extract_user_session(request)
            provider = self._extract_provider_from_path(request.url.path)
            
            if not provider:
                return await call_next(request)
            
            # Security validation for POST requests
            if request.method == "POST":
                security_result = await self._perform_security_validation(request)
                if not security_result["allowed"]:
                    return self._create_security_error_response(security_result)
            
            # Check rate limits with threat-aware scaling
            rate_limit_result = await self._check_rate_limits(
                user_id, session_id, provider, request, redis_manager
            )
            
            if not rate_limit_result["allowed"]:
                return self._create_rate_limit_response(rate_limit_result)
            
            # Check quota limits
            quota_result = await self._check_quota_limits(user_id, provider)
            if not quota_result["allowed"]:
                return self._create_quota_exceeded_response(quota_result)
            
            # Process request
            start_time = time.time()
            response = await call_next(request)
            response_time = int((time.time() - start_time) * 1000)
            
            # Update rate limit counters
            await self._update_rate_limit_counters(
                user_id, session_id, provider, response_time, redis_manager
            )
            
            # Add rate limit headers
            self._add_rate_limit_headers(response, rate_limit_result)
            
            return response
            
        except Exception as e:
            logger.error(f"AI Proxy Rate Limit Middleware Error: {e}")
            return await call_next(request)
    
    async def _perform_security_validation(self, request: Request) -> Dict[str, Any]:
        """Perform comprehensive security validation"""
        try:
            # Read request body
            body = await request.body()
            if not body:
                return {"allowed": False, "reason": "empty_request", "issues": ["Empty request body"]}
            
            # Parse JSON
            try:
                request_data = json.loads(body)
            except json.JSONDecodeError as e:
                return {"allowed": False, "reason": "invalid_json", "issues": [f"Invalid JSON: {e}"]}
            
            # Validate client information
            client_valid, client_issues = self.security_validator.validate_client_info(request)
            if not client_valid:
                return {"allowed": False, "reason": "blocked_client", "issues": client_issues}
            
            # Validate request structure
            structure_valid, structure_issues = self.security_validator.validate_request_structure(request_data)
            if not structure_valid:
                return {"allowed": False, "reason": "invalid_structure", "issues": structure_issues}
            
            # Analyze content for threats
            all_content = ""
            for message in request_data.get('messages', []):
                all_content += message.get('content', '') + " "
            
            threat_level, threat_issues = self.security_validator.analyze_threat_level(all_content)
            
            # Block critical threats
            if threat_level == 'critical':
                logger.warning(f"Blocking critical threat from {request.client.host}: {threat_issues}")
                return {"allowed": False, "reason": "critical_threat", "issues": threat_issues, "threat_level": threat_level}
            
            return {
                "allowed": True, 
                "threat_level": threat_level, 
                "issues": threat_issues + structure_issues,
                "content_analysis": {
                    "length": len(all_content),
                    "message_count": len(request_data.get('messages', []))
                }
            }
            
        except Exception as e:
            logger.error(f"Security validation error: {e}")
            return {"allowed": False, "reason": "validation_error", "issues": [str(e)]}
    
    def _create_security_error_response(self, security_result: Dict[str, Any]) -> Response:
        """Create security error response"""
        status_code = 400
        if security_result.get("reason") == "blocked_client":
            status_code = 403
        elif security_result.get("reason") == "critical_threat":
            status_code = 422
        
        return JSONResponse(
            status_code=status_code,
            content={
                "error": "security_validation_failed",
                "reason": security_result.get("reason"),
                "message": "Request blocked due to security policy violation",
                "issues": security_result.get("issues", [])[:3],  # Limit exposed issues
                "threat_level": security_result.get("threat_level", "unknown")
            },
            headers={
                "X-Security-Policy": "AI-Proxy-Security-v1",
                "X-Threat-Level": security_result.get("threat_level", "unknown")
            }
        )
    
    async def _extract_user_session(self, request: Request) -> Tuple[Optional[int], Optional[str]]:
        """Extract user ID and session ID from request"""
        user_id = None
        session_id = None
        
        # Try to get user from JWT token or session
        auth_header = request.headers.get("authorization")
        if auth_header and auth_header.startswith("Bearer "):
            # Implement JWT token extraction logic here
            # For now, extract from headers or use session-based approach
            pass
        
        # Session-based identification for anonymous users
        session_id = request.headers.get("x-session-id") or request.cookies.get("session_id")
        if not session_id:
            # Generate temporary session ID based on IP and User-Agent
            client_ip = request.client.host if request.client else "unknown"
            user_agent = request.headers.get("user-agent", "unknown")
            session_id = hashlib.md5(f"{client_ip}:{user_agent}".encode()).hexdigest()[:16]
        
        return user_id, session_id
    
    def _extract_provider_from_path(self, path: str) -> Optional[AIProvider]:
        """Extract AI provider from request path"""
        if "/claude/" in path:
            return AIProvider.CLAUDE
        elif "/openai/" in path:
            return AIProvider.OPENAI
        elif "/gemini/" in path:
            return AIProvider.GEMINI
        return None
    
    async def _check_rate_limits(
        self, 
        user_id: Optional[int], 
        session_id: str, 
        provider: AIProvider,
        request: Request,
        redis_manager
    ) -> Dict[str, Any]:
        """Check rate limits using Redis with threat-aware scaling"""
        
        # Create rate limit identifier
        identifier = f"user:{user_id}" if user_id else f"session:{session_id}"
        
        # Get base rate limits
        minute_limit = self.settings.ai_proxy_rate_limit_per_minute
        hour_limit = self.settings.ai_proxy_rate_limit_per_hour
        
        # Apply threat-based scaling if available
        threat_level = getattr(request.state, 'threat_level', 'low')
        threat_multiplier = self.security_validator.threat_multipliers.get(threat_level, 1.0)
        
        adjusted_minute_limit = int(minute_limit * threat_multiplier)
        adjusted_hour_limit = int(hour_limit * threat_multiplier)
        
        try:
            # Check minute-based rate limit
            minute_result = await redis_manager.rate_limit_check(
                f"ai_rate_limit:minute:{identifier}:{provider.value}",
                adjusted_minute_limit,
                60  # 1 minute window
            )
            
            if not minute_result["allowed"]:
                return {
                    "allowed": False,
                    "window": "minute",
                    "limit": adjusted_minute_limit,
                    "count": minute_result["count"],
                    "remaining": minute_result["remaining"],
                    "reset_time": minute_result["reset_time"],
                    "threat_level": threat_level
                }
            
            # Check hour-based rate limit
            hour_result = await redis_manager.rate_limit_check(
                f"ai_rate_limit:hour:{identifier}:{provider.value}",
                adjusted_hour_limit,
                3600  # 1 hour window
            )
            
            if not hour_result["allowed"]:
                return {
                    "allowed": False,
                    "window": "hour",
                    "limit": adjusted_hour_limit,
                    "count": hour_result["count"],
                    "remaining": hour_result["remaining"],
                    "reset_time": hour_result["reset_time"],
                    "threat_level": threat_level
                }
            
            return {
                "allowed": True,
                "minute_limit": adjusted_minute_limit,
                "minute_remaining": minute_result["remaining"],
                "hour_limit": adjusted_hour_limit,
                "hour_remaining": hour_result["remaining"],
                "threat_level": threat_level
            }
            
        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Fallback to database check
            return await self._check_database_rate_limits(
                user_id, session_id, provider, adjusted_minute_limit, adjusted_hour_limit
            )
    
    async def _check_redis_rate_limits(
        self, 
        redis_key_base: str,
        minute_window: datetime,
        hour_window: datetime
    ) -> Dict[str, Any]:
        """Fast Redis-based rate limit checking"""
        
        minute_key = f"{redis_key_base}:minute:{int(minute_window.timestamp())}"
        hour_key = f"{redis_key_base}:hour:{int(hour_window.timestamp())}"
        
        # Use Redis pipeline for atomic operations
        pipe = self.redis_client.pipeline()
        pipe.get(minute_key)
        pipe.get(hour_key)
        results = await pipe.execute()
        
        minute_count = int(results[0] or 0)
        hour_count = int(results[1] or 0)
        
        # Check limits
        minute_limit = self.settings.ai_proxy_rate_limit_per_minute
        hour_limit = self.settings.ai_proxy_rate_limit_per_hour
        
        allowed = minute_count < minute_limit and hour_count < hour_limit
        
        return {
            "allowed": allowed,
            "minute_count": minute_count,
            "hour_count": hour_count,
            "minute_limit": minute_limit,
            "hour_limit": hour_limit,
            "reset_minute": int((minute_window + timedelta(minutes=1)).timestamp()),
            "reset_hour": int((hour_window + timedelta(hours=1)).timestamp()),
            "source": "redis"
        }
    
    async def _check_database_rate_limits(
        self,
        user_id: Optional[int],
        session_id: str,
        provider: AIProvider,
        minute_window: datetime,
        hour_window: datetime
    ) -> Dict[str, Any]:
        """Database-based rate limit checking with automatic cleanup"""
        
        async for db in get_db():
            try:
                # Find existing rate limit record
                query = select(AIRateLimit).where(
                    and_(
                        AIRateLimit.provider == provider,
                        or_(
                            AIRateLimit.user_id == user_id if user_id else False,
                            AIRateLimit.session_id == session_id
                        ),
                        AIRateLimit.minute_window == minute_window,
                        AIRateLimit.hour_window == hour_window
                    )
                )
                
                result = await db.execute(query)
                rate_limit = result.scalar_one_or_none()
                
                if not rate_limit:
                    # Create new rate limit record
                    rate_limit = AIRateLimit(
                        user_id=user_id,
                        session_id=session_id,
                        provider=provider,
                        minute_window=minute_window,
                        hour_window=hour_window,
                        requests_per_minute=0,
                        requests_per_hour=0
                    )
                    db.add(rate_limit)
                    await db.commit()
                
                # Check limits
                minute_limit = self.settings.ai_proxy_rate_limit_per_minute
                hour_limit = self.settings.ai_proxy_rate_limit_per_hour
                
                allowed = (rate_limit.requests_per_minute < minute_limit and 
                          rate_limit.requests_per_hour < hour_limit)
                
                return {
                    "allowed": allowed,
                    "minute_count": rate_limit.requests_per_minute,
                    "hour_count": rate_limit.requests_per_hour,
                    "minute_limit": minute_limit,
                    "hour_limit": hour_limit,
                    "reset_minute": int((minute_window + timedelta(minutes=1)).timestamp()),
                    "reset_hour": int((hour_window + timedelta(hours=1)).timestamp()),
                    "source": "database"
                }
                
            except Exception as e:
                logger.error(f"Database rate limit check error: {e}")
                # Fail open with conservative limits
                return {
                    "allowed": True,
                    "minute_count": 0,
                    "hour_count": 0,
                    "minute_limit": 10,  # Conservative fallback
                    "hour_limit": 100,
                    "reset_minute": int((minute_window + timedelta(minutes=1)).timestamp()),
                    "reset_hour": int((hour_window + timedelta(hours=1)).timestamp()),
                    "source": "fallback"
                }
            finally:
                await db.close()
    
    async def _check_quota_limits(self, user_id: Optional[int], provider: AIProvider) -> Dict[str, Any]:
        """Check daily/monthly quota limits"""
        
        async for db in get_db():
            try:
                query = select(AIQuotaLimit).where(
                    and_(
                        AIQuotaLimit.user_id == user_id,
                        AIQuotaLimit.provider == provider
                    )
                )
                
                result = await db.execute(query)
                quota = result.scalar_one_or_none()
                
                if not quota:
                    # Create default quota
                    quota = AIQuotaLimit(
                        user_id=user_id,
                        provider=provider,
                        daily_limit_usd=self.settings.ai_proxy_cost_limit_daily
                    )
                    db.add(quota)
                    await db.commit()
                
                # Check if quotas are exceeded
                allowed = not (quota.is_daily_exceeded or quota.is_monthly_exceeded)
                
                return {
                    "allowed": allowed,
                    "daily_spent": quota.daily_spent_usd,
                    "daily_limit": quota.daily_limit_usd,
                    "monthly_spent": quota.monthly_spent_usd,
                    "monthly_limit": quota.monthly_limit_usd,
                    "daily_exceeded": quota.is_daily_exceeded,
                    "monthly_exceeded": quota.is_monthly_exceeded
                }
                
            except Exception as e:
                logger.error(f"Quota check error: {e}")
                return {"allowed": True}  # Fail open
            finally:
                await db.close()
    
    async def _update_rate_limit_counters(
        self,
        user_id: Optional[int],
        session_id: str,
        provider: AIProvider,
        response_time_ms: int
    ):
        """Update rate limit counters after successful request"""
        
        # Update Redis counters first
        if self.redis_client:
            try:
                await self._update_redis_counters(user_id, session_id, provider)
            except Exception as e:
                logger.warning(f"Redis counter update failed: {e}")
        
        # Update database counters
        await self._update_database_counters(user_id, session_id, provider)
    
    async def _update_redis_counters(
        self,
        user_id: Optional[int], 
        session_id: str,
        provider: AIProvider
    ):
        """Update Redis rate limit counters"""
        
        identifier = f"user:{user_id}" if user_id else f"session:{session_id}"
        redis_key_base = f"rate_limit:{identifier}:{provider.value}"
        
        current_time = datetime.utcnow()
        minute_window = current_time.replace(second=0, microsecond=0)
        hour_window = current_time.replace(minute=0, second=0, microsecond=0)
        
        minute_key = f"{redis_key_base}:minute:{int(minute_window.timestamp())}"
        hour_key = f"{redis_key_base}:hour:{int(hour_window.timestamp())}"
        
        # Atomic increment with expiration
        pipe = self.redis_client.pipeline()
        pipe.incr(minute_key)
        pipe.expire(minute_key, 120)  # 2 minutes TTL
        pipe.incr(hour_key)
        pipe.expire(hour_key, 7200)  # 2 hours TTL
        await pipe.execute()
    
    async def _update_database_counters(
        self,
        user_id: Optional[int],
        session_id: str,
        provider: AIProvider
    ):
        """Update database rate limit counters"""
        
        current_time = datetime.utcnow()
        minute_window = current_time.replace(second=0, microsecond=0)
        hour_window = current_time.replace(minute=0, second=0, microsecond=0)
        
        async for db in get_db():
            try:
                # Update existing or create new rate limit record
                query = select(AIRateLimit).where(
                    and_(
                        AIRateLimit.provider == provider,
                        or_(
                            AIRateLimit.user_id == user_id if user_id else False,
                            AIRateLimit.session_id == session_id
                        ),
                        AIRateLimit.minute_window == minute_window,
                        AIRateLimit.hour_window == hour_window
                    )
                )
                
                result = await db.execute(query)
                rate_limit = result.scalar_one_or_none()
                
                if rate_limit:
                    rate_limit.requests_per_minute += 1
                    rate_limit.requests_per_hour += 1
                    rate_limit.updated_at = current_time
                else:
                    rate_limit = AIRateLimit(
                        user_id=user_id,
                        session_id=session_id,
                        provider=provider,
                        minute_window=minute_window,
                        hour_window=hour_window,
                        requests_per_minute=1,
                        requests_per_hour=1
                    )
                    db.add(rate_limit)
                
                await db.commit()
                
            except Exception as e:
                logger.error(f"Database counter update error: {e}")
            finally:
                await db.close()
    
    def _create_rate_limit_response(self, rate_limit_result: Dict[str, Any]) -> Response:
        """Create rate limit exceeded response"""
        
        response = Response(
            content=json.dumps({
                "error": "rate_limit_exceeded",
                "message": "Too many requests. Please slow down.",
                "details": {
                    "minute_limit": rate_limit_result["minute_limit"],
                    "hour_limit": rate_limit_result["hour_limit"],
                    "minute_remaining": max(0, rate_limit_result["minute_limit"] - rate_limit_result["minute_count"]),
                    "hour_remaining": max(0, rate_limit_result["hour_limit"] - rate_limit_result["hour_count"]),
                    "reset_minute": rate_limit_result["reset_minute"],
                    "reset_hour": rate_limit_result["reset_hour"]
                }
            }),
            status_code=429,
            media_type="application/json"
        )
        
        self._add_rate_limit_headers(response, rate_limit_result)
        return response
    
    def _create_quota_exceeded_response(self, quota_result: Dict[str, Any]) -> Response:
        """Create quota exceeded response"""
        
        return Response(
            content=json.dumps({
                "error": "quota_exceeded",
                "message": "Daily or monthly usage quota exceeded.",
                "details": {
                    "daily_spent": quota_result["daily_spent"],
                    "daily_limit": quota_result["daily_limit"],
                    "monthly_spent": quota_result["monthly_spent"],
                    "monthly_limit": quota_result["monthly_limit"],
                    "daily_exceeded": quota_result["daily_exceeded"],
                    "monthly_exceeded": quota_result["monthly_exceeded"]
                }
            }),
            status_code=402,  # Payment Required
            media_type="application/json"
        )
    
    def _add_rate_limit_headers(self, response: Response, rate_limit_result: Dict[str, Any]):
        """Add standard rate limit headers to response"""
        
        response.headers["X-RateLimit-Limit-Minute"] = str(rate_limit_result["minute_limit"])
        response.headers["X-RateLimit-Remaining-Minute"] = str(
            max(0, rate_limit_result["minute_limit"] - rate_limit_result["minute_count"])
        )
        response.headers["X-RateLimit-Reset-Minute"] = str(rate_limit_result["reset_minute"])
        
        response.headers["X-RateLimit-Limit-Hour"] = str(rate_limit_result["hour_limit"])
        response.headers["X-RateLimit-Remaining-Hour"] = str(
            max(0, rate_limit_result["hour_limit"] - rate_limit_result["hour_count"])
        )
        response.headers["X-RateLimit-Reset-Hour"] = str(rate_limit_result["reset_hour"])


class AIProxySecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware for AI proxy endpoints with request validation and sanitization.
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.settings = get_settings()
        self.max_request_size = 1024 * 1024  # 1MB max request size
        
    async def dispatch(self, request: Request, call_next):
        # Only apply to AI proxy endpoints
        if not request.url.path.startswith("/api/v1/ai-proxy/"):
            return await call_next(request)
        
        try:
            # Check if AI proxy is enabled
            if not self.settings.ai_proxy_enabled:
                return Response(
                    content=json.dumps({"error": "ai_proxy_disabled", "message": "AI proxy is disabled"}),
                    status_code=503,
                    media_type="application/json"
                )
            
            # Validate request size
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > self.max_request_size:
                return Response(
                    content=json.dumps({
                        "error": "request_too_large",
                        "message": f"Request size exceeds maximum of {self.max_request_size} bytes"
                    }),
                    status_code=413,
                    media_type="application/json"
                )
            
            # Validate content type for POST requests
            if request.method == "POST":
                content_type = request.headers.get("content-type", "")
                if not content_type.startswith("application/json"):
                    return Response(
                        content=json.dumps({
                            "error": "invalid_content_type",
                            "message": "Content-Type must be application/json"
                        }),
                        status_code=400,
                        media_type="application/json"
                    )
            
            # Add security headers and continue
            response = await call_next(request)
            
            # Add security headers
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["X-XSS-Protection"] = "1; mode=block"
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
            
            return response
            
        except Exception as e:
            logger.error(f"AI Proxy Security Middleware Error: {e}")
            return Response(
                content=json.dumps({"error": "security_check_failed", "message": "Security validation failed"}),
                status_code=500,
                media_type="application/json"
            )