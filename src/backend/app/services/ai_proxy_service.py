"""
AI Proxy Service with Request Validation, Response Caching, and Circuit Breaker Patterns.
Production-ready service architecture for secure AI API proxying.
"""

import asyncio
import hashlib
import json
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Union
from redis.asyncio import Redis as AIORedis
import aiohttp
from anthropic import AsyncAnthropic
from openai import AsyncOpenAI
from circuitbreaker import circuit
import logging

from app.config import get_settings
from app.models import (
    AIProvider, AIRequestStatus, AIUsageLog, AIResponseCache, 
    AICircuitBreaker, AIQuotaLimit
)
from app.database import get_db
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)
settings = get_settings()


class AIProviderServiceBase(ABC):
    """Abstract base class for AI provider services"""
    
    def __init__(self, provider: AIProvider, redis_client: Optional[AIORedis] = None):
        self.provider = provider
        self.redis_client = redis_client
        self.settings = get_settings()
        
    @abstractmethod
    async def validate_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and sanitize incoming request"""
        pass
    
    @abstractmethod
    async def make_api_request(self, validated_request: Dict[str, Any]) -> Dict[str, Any]:
        """Make the actual API request to the provider"""
        pass
    
    @abstractmethod
    def calculate_cost(self, usage_data: Dict[str, Any]) -> float:
        """Calculate the estimated cost of the request"""
        pass
    
    async def process_request(
        self, 
        request_data: Dict[str, Any],
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Main request processing pipeline with caching and logging"""
        
        start_time = time.time()
        request_hash = None
        
        try:
            # 1. Validate request
            validated_request = await self.validate_request(request_data)
            
            # 2. Generate request hash for caching
            request_hash = self._generate_request_hash(validated_request)
            
            # 3. Check cache first
            cached_response = await self._get_cached_response(request_hash)
            if cached_response:
                await self._log_request(
                    user_id, session_id, request_hash, validated_request,
                    cached_response, AIRequestStatus.CACHED, 0
                )
                return {
                    "success": True,
                    "data": cached_response["response_data"],
                    "cached": True,
                    "cost": cached_response.get("estimated_cost_usd", 0.0)
                }
            
            # 4. Check circuit breaker
            if await self._is_circuit_open():
                return {
                    "success": False,
                    "error": "service_unavailable",
                    "message": f"{self.provider.value} service is temporarily unavailable"
                }
            
            # 5. Make API request
            api_response = await self._make_api_request_with_circuit_breaker(validated_request)
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # 6. Calculate cost
            cost = self.calculate_cost(api_response.get("usage", {}))
            
            # 7. Cache successful response
            if api_response.get("success"):
                await self._cache_response(request_hash, validated_request, api_response, cost)
            
            # 8. Log request
            status = AIRequestStatus.SUCCESS if api_response.get("success") else AIRequestStatus.FAILED
            await self._log_request(
                user_id, session_id, request_hash, validated_request,
                api_response, status, response_time_ms, cost
            )
            
            # 9. Update quota if successful
            if api_response.get("success") and user_id:
                await self._update_quota_usage(user_id, cost)
            
            return {
                "success": api_response.get("success", False),
                "data": api_response.get("data"),
                "error": api_response.get("error"),
                "cached": False,
                "cost": cost,
                "response_time_ms": response_time_ms
            }
            
        except Exception as e:
            logger.error(f"AI Proxy Service Error ({self.provider.value}): {e}")
            response_time_ms = int((time.time() - start_time) * 1000)
            
            # Log failed request
            if request_hash:
                await self._log_request(
                    user_id, session_id, request_hash, request_data,
                    {"error": str(e)}, AIRequestStatus.FAILED, response_time_ms
                )
            
            return {
                "success": False,
                "error": "internal_error",
                "message": "An internal error occurred while processing your request",
                "cost": 0.0
            }
    
    def _generate_request_hash(self, request_data: Dict[str, Any]) -> str:
        """Generate a consistent hash for request caching"""
        # Normalize request data for consistent hashing
        normalized = self._normalize_request_for_caching(request_data)
        request_string = json.dumps(normalized, sort_keys=True)
        return hashlib.sha256(f"{self.provider.value}:{request_string}".encode()).hexdigest()
    
    def _normalize_request_for_caching(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize request data for consistent caching"""
        # Remove non-deterministic fields
        normalized = request_data.copy()
        
        # Remove fields that shouldn't affect caching
        fields_to_remove = ['stream', 'user', 'temperature', 'top_p', 'frequency_penalty', 'presence_penalty']
        for field in fields_to_remove:
            normalized.pop(field, None)
        
        # Normalize temperature to discrete values for better cache hits
        if 'temperature' in request_data:
            temp = request_data.get('temperature', 0.7)
            normalized['temperature'] = round(temp * 10) / 10  # Round to 1 decimal
        
        return normalized
    
    async def _get_cached_response(self, request_hash: str) -> Optional[Dict[str, Any]]:
        """Get cached response from Redis or database"""
        
        # Try Redis first
        if self.redis_client:
            try:
                cached_data = await self.redis_client.get(f"ai_cache:{request_hash}")
                if cached_data:
                    return json.loads(cached_data)
            except Exception as e:
                logger.warning(f"Redis cache get failed: {e}")
        
        # Fallback to database
        try:
            async for db in get_db():
                query = select(AIResponseCache).where(
                    and_(
                        AIResponseCache.request_hash == request_hash,
                        AIResponseCache.expires_at > datetime.utcnow()
                    )
                )
                result = await db.execute(query)
                cache_entry = result.scalar_one_or_none()
                
                if cache_entry:
                    # Update hit count and last accessed
                    cache_entry.hit_count += 1
                    cache_entry.last_accessed = datetime.utcnow()
                    await db.commit()
                    
                    return {
                        "response_data": cache_entry.response_data,
                        "estimated_cost_usd": cache_entry.estimated_cost_usd
                    }
                
                await db.close()
                break
        except Exception as e:
            logger.error(f"Database cache get failed: {e}")
        
        return None
    
    async def _cache_response(
        self, 
        request_hash: str, 
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        cost: float
    ):
        """Cache response in Redis and database"""
        
        cache_data = {
            "response_data": response_data,
            "estimated_cost_usd": cost,
            "cached_at": datetime.utcnow().isoformat()
        }
        
        # Cache in Redis
        if self.redis_client:
            try:
                await self.redis_client.setex(
                    f"ai_cache:{request_hash}",
                    self.settings.ai_proxy_cache_ttl_seconds,
                    json.dumps(cache_data, default=str)
                )
            except Exception as e:
                logger.warning(f"Redis cache set failed: {e}")
        
        # Cache in database
        try:
            async for db in get_db():
                expires_at = datetime.utcnow() + timedelta(seconds=self.settings.ai_proxy_cache_ttl_seconds)
                
                cache_entry = AIResponseCache(
                    request_hash=request_hash,
                    provider=self.provider,
                    model=request_data.get('model', 'unknown'),
                    request_data=request_data,
                    response_data=response_data,
                    estimated_cost_usd=cost,
                    expires_at=expires_at
                )
                
                db.add(cache_entry)
                await db.commit()
                await db.close()
                break
        except Exception as e:
            logger.error(f"Database cache set failed: {e}")
    
    async def _is_circuit_open(self) -> bool:
        """Check if circuit breaker is open"""
        try:
            async for db in get_db():
                query = select(AICircuitBreaker).where(AICircuitBreaker.provider == self.provider)
                result = await db.execute(query)
                circuit_breaker = result.scalar_one_or_none()
                
                if not circuit_breaker:
                    return False
                
                if circuit_breaker.state == "open":
                    # Check if recovery time has passed
                    if (circuit_breaker.next_attempt_time and 
                        datetime.utcnow() >= circuit_breaker.next_attempt_time):
                        # Move to half-open state
                        circuit_breaker.state = "half_open"
                        await db.commit()
                        return False
                    return True
                
                await db.close()
                break
                
        except Exception as e:
            logger.error(f"Circuit breaker check failed: {e}")
        
        return False
    
    async def _make_api_request_with_circuit_breaker(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Make API request with circuit breaker pattern"""
        try:
            response = await self.make_api_request(request_data)
            
            # Record success for circuit breaker
            await self._record_circuit_breaker_success()
            
            return response
            
        except Exception as e:
            # Record failure for circuit breaker
            await self._record_circuit_breaker_failure(str(e))
            raise
    
    async def _record_circuit_breaker_success(self):
        """Record successful request for circuit breaker"""
        try:
            async for db in get_db():
                query = select(AICircuitBreaker).where(AICircuitBreaker.provider == self.provider)
                result = await db.execute(query)
                circuit_breaker = result.scalar_one_or_none()
                
                if not circuit_breaker:
                    circuit_breaker = AICircuitBreaker(
                        provider=self.provider,
                        failure_threshold=self.settings.circuit_breaker_failure_threshold
                    )
                    db.add(circuit_breaker)
                
                circuit_breaker.success_count += 1
                circuit_breaker.last_success_time = datetime.utcnow()
                
                # Reset circuit breaker if in half-open state
                if circuit_breaker.state == "half_open":
                    circuit_breaker.state = "closed"
                    circuit_breaker.failure_count = 0
                
                await db.commit()
                await db.close()
                break
                
        except Exception as e:
            logger.error(f"Circuit breaker success recording failed: {e}")
    
    async def _record_circuit_breaker_failure(self, error_message: str):
        """Record failed request for circuit breaker"""
        try:
            async for db in get_db():
                query = select(AICircuitBreaker).where(AICircuitBreaker.provider == self.provider)
                result = await db.execute(query)
                circuit_breaker = result.scalar_one_or_none()
                
                if not circuit_breaker:
                    circuit_breaker = AICircuitBreaker(
                        provider=self.provider,
                        failure_threshold=self.settings.circuit_breaker_failure_threshold,
                        recovery_timeout_seconds=self.settings.circuit_breaker_recovery_timeout
                    )
                    db.add(circuit_breaker)
                
                circuit_breaker.failure_count += 1
                circuit_breaker.last_failure_time = datetime.utcnow()
                
                # Open circuit if failure threshold exceeded
                if circuit_breaker.failure_count >= circuit_breaker.failure_threshold:
                    circuit_breaker.state = "open"
                    circuit_breaker.next_attempt_time = (
                        datetime.utcnow() + timedelta(seconds=circuit_breaker.recovery_timeout_seconds)
                    )
                
                await db.commit()
                await db.close()
                break
                
        except Exception as e:
            logger.error(f"Circuit breaker failure recording failed: {e}")
    
    async def _log_request(
        self,
        user_id: Optional[int],
        session_id: Optional[str],
        request_hash: str,
        request_data: Dict[str, Any],
        response_data: Dict[str, Any],
        status: AIRequestStatus,
        response_time_ms: int,
        cost: float = 0.0
    ):
        """Log request for monitoring and analytics"""
        try:
            async for db in get_db():
                usage_log = AIUsageLog(
                    user_id=user_id,
                    session_id=session_id,
                    provider=self.provider,
                    model=request_data.get('model', 'unknown'),
                    endpoint=request_data.get('endpoint', '/unknown'),
                    request_hash=request_hash,
                    request_tokens=response_data.get('usage', {}).get('prompt_tokens'),
                    response_tokens=response_data.get('usage', {}).get('completion_tokens'),
                    total_tokens=response_data.get('usage', {}).get('total_tokens'),
                    status=status,
                    response_time_ms=response_time_ms,
                    estimated_cost_usd=cost,
                    error_message=response_data.get('error'),
                    request_metadata={
                        "model": request_data.get('model'),
                        "max_tokens": request_data.get('max_tokens'),
                        "temperature": request_data.get('temperature')
                    }
                )
                
                db.add(usage_log)
                await db.commit()
                await db.close()
                break
                
        except Exception as e:
            logger.error(f"Request logging failed: {e}")
    
    async def _update_quota_usage(self, user_id: int, cost: float):
        """Update user quota usage"""
        try:
            async for db in get_db():
                query = select(AIQuotaLimit).where(
                    and_(
                        AIQuotaLimit.user_id == user_id,
                        AIQuotaLimit.provider == self.provider
                    )
                )
                result = await db.execute(query)
                quota = result.scalar_one_or_none()
                
                if not quota:
                    quota = AIQuotaLimit(
                        user_id=user_id,
                        provider=self.provider,
                        daily_limit_usd=self.settings.ai_proxy_cost_limit_daily
                    )
                    db.add(quota)
                
                # Update usage
                quota.daily_spent_usd += cost
                quota.monthly_spent_usd += cost
                quota.daily_requests += 1
                quota.monthly_requests += 1
                
                # Check if limits exceeded
                quota.is_daily_exceeded = quota.daily_spent_usd >= quota.daily_limit_usd
                quota.is_monthly_exceeded = quota.monthly_spent_usd >= quota.monthly_limit_usd
                
                await db.commit()
                await db.close()
                break
                
        except Exception as e:
            logger.error(f"Quota update failed: {e}")


class ClaudeAIService(AIProviderServiceBase):
    """Claude AI service implementation"""
    
    def __init__(self, redis_client: Optional[AIORedis] = None):
        super().__init__(AIProvider.CLAUDE, redis_client)
        api_key = self.settings.claude_api_key.get_secret_value()
        if api_key != "your_claude_api_key_here":
            self.client = AsyncAnthropic(api_key=api_key)
        else:
            self.client = None
    
    async def validate_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate Claude API request"""
        if not self.client:
            raise ValueError("Claude API key not configured")
        
        # Required fields
        if "messages" not in request_data:
            raise ValueError("messages field is required")
        
        if not isinstance(request_data["messages"], list):
            raise ValueError("messages must be a list")
        
        # Validate messages format
        for i, message in enumerate(request_data["messages"]):
            if not isinstance(message, dict):
                raise ValueError(f"Message {i} must be a dictionary")
            if "role" not in message or "content" not in message:
                raise ValueError(f"Message {i} must have 'role' and 'content' fields")
            if message["role"] not in ["user", "assistant", "system"]:
                raise ValueError(f"Message {i} has invalid role: {message['role']}")
        
        # Sanitize and set defaults
        validated = {
            "model": request_data.get("model", self.settings.default_ai_model),
            "messages": request_data["messages"],
            "max_tokens": min(request_data.get("max_tokens", 1000), self.settings.ai_proxy_max_tokens),
            "temperature": max(0.0, min(1.0, request_data.get("temperature", 0.7))),
            "endpoint": "/v1/messages"
        }
        
        # Token estimation for cost calculation
        estimated_input_tokens = sum(len(msg["content"]) // 4 for msg in validated["messages"])
        validated["estimated_input_tokens"] = estimated_input_tokens
        
        return validated
    
    async def make_api_request(self, validated_request: Dict[str, Any]) -> Dict[str, Any]:
        """Make request to Claude API"""
        try:
            response = await self.client.messages.create(
                model=validated_request["model"],
                max_tokens=validated_request["max_tokens"],
                temperature=validated_request["temperature"],
                messages=validated_request["messages"]
            )
            
            return {
                "success": True,
                "data": {
                    "id": response.id,
                    "model": response.model,
                    "content": [{"type": "text", "text": response.content[0].text}],
                    "usage": {
                        "input_tokens": response.usage.input_tokens,
                        "output_tokens": response.usage.output_tokens,
                        "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                    }
                },
                "usage": {
                    "prompt_tokens": response.usage.input_tokens,
                    "completion_tokens": response.usage.output_tokens,
                    "total_tokens": response.usage.input_tokens + response.usage.output_tokens
                }
            }
            
        except Exception as e:
            logger.error(f"Claude API request failed: {e}")
            return {
                "success": False,
                "error": "api_request_failed",
                "message": str(e)
            }
    
    def calculate_cost(self, usage_data: Dict[str, Any]) -> float:
        """Calculate cost for Claude API usage"""
        # Claude pricing (approximate, adjust based on actual pricing)
        input_tokens = usage_data.get("prompt_tokens", 0)
        output_tokens = usage_data.get("completion_tokens", 0)
        
        # Pricing per 1000 tokens (example rates)
        input_cost_per_1k = 0.008  # $0.008 per 1K input tokens
        output_cost_per_1k = 0.024  # $0.024 per 1K output tokens
        
        input_cost = (input_tokens / 1000) * input_cost_per_1k
        output_cost = (output_tokens / 1000) * output_cost_per_1k
        
        return round(input_cost + output_cost, 6)


class OpenAIService(AIProviderServiceBase):
    """OpenAI service implementation"""
    
    def __init__(self, redis_client: Optional[AIORedis] = None):
        super().__init__(AIProvider.OPENAI, redis_client)
        api_key = self.settings.openai_api_key.get_secret_value()
        if api_key != "your_openai_api_key_here":
            self.client = AsyncOpenAI(api_key=api_key)
        else:
            self.client = None
    
    async def validate_request(self, request_data: Dict[str, Any]) -> Dict[str, Any]:
        """Validate OpenAI API request"""
        if not self.client:
            raise ValueError("OpenAI API key not configured")
        
        # Required fields
        if "messages" not in request_data:
            raise ValueError("messages field is required")
        
        # Validate and sanitize
        validated = {
            "model": request_data.get("model", "gpt-3.5-turbo"),
            "messages": request_data["messages"],
            "max_tokens": min(request_data.get("max_tokens", 1000), self.settings.ai_proxy_max_tokens),
            "temperature": max(0.0, min(2.0, request_data.get("temperature", 0.7))),
            "endpoint": "/v1/chat/completions"
        }
        
        return validated
    
    async def make_api_request(self, validated_request: Dict[str, Any]) -> Dict[str, Any]:
        """Make request to OpenAI API"""
        try:
            response = await self.client.chat.completions.create(
                model=validated_request["model"],
                messages=validated_request["messages"],
                max_tokens=validated_request["max_tokens"],
                temperature=validated_request["temperature"]
            )
            
            return {
                "success": True,
                "data": {
                    "id": response.id,
                    "model": response.model,
                    "choices": [
                        {
                            "message": {
                                "role": response.choices[0].message.role,
                                "content": response.choices[0].message.content
                            },
                            "finish_reason": response.choices[0].finish_reason
                        }
                    ],
                    "usage": {
                        "prompt_tokens": response.usage.prompt_tokens,
                        "completion_tokens": response.usage.completion_tokens,
                        "total_tokens": response.usage.total_tokens
                    }
                },
                "usage": response.usage.model_dump()
            }
            
        except Exception as e:
            logger.error(f"OpenAI API request failed: {e}")
            return {
                "success": False,
                "error": "api_request_failed",
                "message": str(e)
            }
    
    def calculate_cost(self, usage_data: Dict[str, Any]) -> float:
        """Calculate cost for OpenAI API usage"""
        # OpenAI pricing (approximate, adjust based on actual pricing)
        input_tokens = usage_data.get("prompt_tokens", 0)
        output_tokens = usage_data.get("completion_tokens", 0)
        
        # GPT-3.5-turbo pricing per 1000 tokens
        input_cost_per_1k = 0.001  # $0.001 per 1K input tokens
        output_cost_per_1k = 0.002  # $0.002 per 1K output tokens
        
        input_cost = (input_tokens / 1000) * input_cost_per_1k
        output_cost = (output_tokens / 1000) * output_cost_per_1k
        
        return round(input_cost + output_cost, 6)


class AIProxyServiceManager:
    """Manager class for AI proxy services"""
    
    def __init__(self, redis_client: Optional[AIORedis] = None):
        self.redis_client = redis_client
        self.services = {
            AIProvider.CLAUDE: ClaudeAIService(redis_client),
            AIProvider.OPENAI: OpenAIService(redis_client)
        }
    
    def get_service(self, provider: AIProvider) -> AIProviderServiceBase:
        """Get service instance for provider"""
        service = self.services.get(provider)
        if not service:
            raise ValueError(f"Unsupported AI provider: {provider}")
        return service
    
    async def process_request(
        self,
        provider: AIProvider,
        request_data: Dict[str, Any],
        user_id: Optional[int] = None,
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process request through appropriate service"""
        service = self.get_service(provider)
        return await service.process_request(request_data, user_id, session_id)
    
    async def get_service_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all AI services"""
        status = {}
        
        for provider, service in self.services.items():
            try:
                # Check if circuit breaker is open
                circuit_open = await service._is_circuit_open()
                
                # Get recent usage stats
                async for db in get_db():
                    query = select(AIUsageLog).where(
                        and_(
                            AIUsageLog.provider == provider,
                            AIUsageLog.created_at >= datetime.utcnow() - timedelta(hours=1)
                        )
                    )
                    result = await db.execute(query)
                    recent_requests = result.fetchall()
                    
                    success_count = sum(1 for r in recent_requests if r.status == AIRequestStatus.SUCCESS)
                    total_count = len(recent_requests)
                    
                    status[provider.value] = {
                        "available": not circuit_open,
                        "circuit_open": circuit_open,
                        "recent_requests": total_count,
                        "success_rate": (success_count / total_count) if total_count > 0 else 1.0,
                        "avg_response_time": sum(r.response_time_ms for r in recent_requests) / total_count if total_count > 0 else 0
                    }
                    
                    await db.close()
                    break
                    
            except Exception as e:
                logger.error(f"Error getting status for {provider.value}: {e}")
                status[provider.value] = {
                    "available": False,
                    "error": str(e)
                }
        
        return status