"""AI Proxy Router - Production-ready secure AI API endpoints"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from redis.asyncio import Redis as AIORedis
import logging

from app.config import get_settings
from app.database import get_db
from app.models import (
    AIProvider, AIUsageLog, AIRequestStatus, AIQuotaLimit, 
    AICircuitBreaker, AIResponseCache
)
from app.services.ai_proxy_service import AIProxyServiceManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/ai-proxy", tags=["AI Proxy"])
settings = get_settings()

# Global service manager instance
service_manager: Optional[AIProxyServiceManager] = None
redis_client: Optional[AIORedis] = None

# Request/Response Models
class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str = Field(..., min_length=1, max_length=32000)

class AIProxyRequest(BaseModel):
    """Standardized AI proxy request format"""
    messages: List[ChatMessage] = Field(..., min_items=1, max_items=50)
    model: Optional[str] = Field(None, max_length=100)
    max_tokens: Optional[int] = Field(None, ge=1, le=8000)
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    top_p: Optional[float] = Field(1.0, ge=0.0, le=1.0)
    stream: Optional[bool] = False
    user: Optional[str] = Field(None, max_length=100)  # User identifier
    
    @validator('messages')
    def validate_messages(cls, v):
        if not v:
            raise ValueError("At least one message is required")
        
        # Ensure messages alternate properly and start with user/system
        if v[0].role not in ['user', 'system']:
            raise ValueError("First message must be from user or system")
        
        return v

class AIProxyResponse(BaseModel):
    """Standardized AI proxy response format"""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    message: Optional[str] = None
    cached: bool = False
    cost: float = 0.0
    response_time_ms: Optional[int] = None
    rate_limit_remaining: Optional[int] = None
    quota_remaining: Optional[float] = None

class UsageAnalyticsResponse(BaseModel):
    """Usage analytics response"""
    total_requests: int
    successful_requests: int
    failed_requests: int
    cached_requests: int
    total_cost: float
    average_response_time: float
    requests_by_provider: Dict[str, int]
    cost_by_provider: Dict[str, float]
    daily_usage: List[Dict[str, Any]]

# Dependency Functions
async def get_redis_client() -> Optional[AIORedis]:
    """Get Redis client with connection pooling"""
    global redis_client
    if not redis_client and settings.redis_enabled:
        try:
            redis_client = AIORedis.from_url(
                settings.redis_url,
                max_connections=settings.redis_max_connections,
                retry_on_timeout=True,
                socket_connect_timeout=5,
                socket_timeout=10
            )
            # Test connection
            await redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Redis connection failed: {e}")
            redis_client = None
    return redis_client

async def get_service_manager() -> AIProxyServiceManager:
    """Get AI service manager with Redis client"""
    global service_manager
    if not service_manager:
        redis = await get_redis_client()
        service_manager = AIProxyServiceManager(redis)
    return service_manager

async def extract_user_session(request: Request) -> tuple[Optional[int], Optional[str]]:
    """Extract user ID and session ID from request"""
    # Extract from headers or implement JWT token extraction
    user_id = None  # Implement JWT extraction here
    session_id = request.headers.get("x-session-id") or request.cookies.get("session_id")
    
    if not session_id:
        # Generate session ID based on client info
        import hashlib
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")
        session_id = hashlib.md5(f"{client_ip}:{user_agent}".encode()).hexdigest()[:16]
    
    return user_id, session_id

# Core AI Proxy Endpoints
@router.post("/claude/chat", response_model=AIProxyResponse)
async def claude_chat_completion(
    request_data: AIProxyRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    service_manager: AIProxyServiceManager = Depends(get_service_manager)
):
    """Claude AI chat completion endpoint with full security and monitoring"""
    
    user_id, session_id = await extract_user_session(request)
    
    try:
        # Process request through service manager
        result = await service_manager.process_request(
            AIProvider.CLAUDE,
            request_data.dict(),
            user_id=user_id,
            session_id=session_id
        )
        
        # Add rate limit info to response
        if not result.get("success") and result.get("error") == "rate_limit_exceeded":
            return JSONResponse(
                status_code=429,
                content=result,
                headers={
                    "X-RateLimit-Limit": "60",
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": "60"
                }
            )
        
        return AIProxyResponse(**result)
        
    except Exception as e:
        logger.error(f"Claude chat completion error: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "Request failed"}
        )

@router.post("/openai/chat", response_model=AIProxyResponse)
async def openai_chat_completion(
    request_data: AIProxyRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    service_manager: AIProxyServiceManager = Depends(get_service_manager)
):
    """OpenAI chat completion endpoint with full security and monitoring"""
    
    user_id, session_id = await extract_user_session(request)
    
    try:
        result = await service_manager.process_request(
            AIProvider.OPENAI,
            request_data.dict(),
            user_id=user_id,
            session_id=session_id
        )
        
        return AIProxyResponse(**result)
        
    except Exception as e:
        logger.error(f"OpenAI chat completion error: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "internal_error", "message": "Request failed"}
        )

# Provider Status and Monitoring Endpoints
@router.get("/providers/status")
async def get_providers_status(
    service_manager: AIProxyServiceManager = Depends(get_service_manager)
):
    """Get status of all AI providers including circuit breaker state"""
    try:
        status = await service_manager.get_service_status()
        
        # Add configuration info
        claude_key = settings.claude_api_key.get_secret_value()
        openai_key = settings.openai_api_key.get_secret_value()
        
        status["claude"]["configured"] = claude_key != "your_claude_api_key_here"
        status["openai"]["configured"] = openai_key != "your_openai_api_key_here"
        
        return {
            "success": True,
            "providers": status,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Provider status error: {e}")
        raise HTTPException(status_code=500, detail="Failed to get provider status")

@router.get("/providers")
async def get_ai_providers():
    """Get list of available AI providers with current status"""
    settings = get_settings()
    claude_key = settings.claude_api_key.get_secret_value()
    openai_key = settings.openai_api_key.get_secret_value()
    
    claude_active = claude_key != "your_claude_api_key_here"
    openai_active = openai_key != "your_openai_api_key_here"
    
    providers = [
        {
            "id": "claude",
            "name": "Claude",
            "isActive": claude_active,
            "status": "Connected" if claude_active else "Disconnected",
            "models": ["claude-3-sonnet", "claude-3-haiku", "claude-3-opus"],
            "features": ["chat", "text-generation", "analysis"],
            "lastUsed": None  # TODO: Get from database
        },
        {
            "id": "openai",
            "name": "OpenAI GPT",
            "isActive": openai_active,
            "status": "Connected" if openai_active else "Disconnected",
            "models": ["gpt-4", "gpt-3.5-turbo"],
            "features": ["chat", "text-generation"],
            "lastUsed": None  # TODO: Get from database
        }
    ]
    return {"providers": providers}

# Usage Analytics and Monitoring
@router.get("/usage/analytics", response_model=UsageAnalyticsResponse)
async def get_usage_analytics(
    days: int = 7,
    provider: Optional[str] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """Get comprehensive usage analytics"""
    
    user_id, session_id = await extract_user_session(request)
    
    try:
        # Base query with date filter
        start_date = datetime.utcnow() - timedelta(days=days)
        base_query = select(AIUsageLog).where(AIUsageLog.created_at >= start_date)
        
        # Apply user/session filter
        if user_id:
            base_query = base_query.where(AIUsageLog.user_id == user_id)
        elif session_id:
            base_query = base_query.where(AIUsageLog.session_id == session_id)
        
        # Apply provider filter
        if provider:
            try:
                provider_enum = AIProvider(provider)
                base_query = base_query.where(AIUsageLog.provider == provider_enum)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
        
        # Execute query
        result = await db.execute(base_query)
        logs = result.scalars().all()
        
        # Calculate analytics
        total_requests = len(logs)
        successful_requests = sum(1 for log in logs if log.status == AIRequestStatus.SUCCESS)
        failed_requests = sum(1 for log in logs if log.status == AIRequestStatus.FAILED)
        cached_requests = sum(1 for log in logs if log.status == AIRequestStatus.CACHED)
        
        total_cost = sum(log.estimated_cost_usd or 0.0 for log in logs)
        
        response_times = [log.response_time_ms for log in logs if log.response_time_ms]
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        # Group by provider
        requests_by_provider = {}
        cost_by_provider = {}
        for log in logs:
            provider_name = log.provider.value
            requests_by_provider[provider_name] = requests_by_provider.get(provider_name, 0) + 1
            cost_by_provider[provider_name] = cost_by_provider.get(provider_name, 0.0) + (log.estimated_cost_usd or 0.0)
        
        # Daily usage breakdown
        daily_usage = []
        for i in range(days):
            day = start_date + timedelta(days=i)
            day_logs = [log for log in logs if log.created_at.date() == day.date()]
            daily_usage.append({
                "date": day.date().isoformat(),
                "requests": len(day_logs),
                "cost": sum(log.estimated_cost_usd or 0.0 for log in day_logs),
                "avg_response_time": sum(log.response_time_ms or 0 for log in day_logs) / len(day_logs) if day_logs else 0
            })
        
        return UsageAnalyticsResponse(
            total_requests=total_requests,
            successful_requests=successful_requests,
            failed_requests=failed_requests,
            cached_requests=cached_requests,
            total_cost=round(total_cost, 4),
            average_response_time=round(avg_response_time, 2),
            requests_by_provider=requests_by_provider,
            cost_by_provider={k: round(v, 4) for k, v in cost_by_provider.items()},
            daily_usage=daily_usage
        )
        
    except Exception as e:
        logger.error(f"Usage analytics error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve usage analytics")

@router.get("/usage/quota")
async def get_usage_quota(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get current usage quota status"""
    
    user_id, session_id = await extract_user_session(request)
    
    if not user_id:
        # For anonymous users, return basic info
        return {
            "user_type": "anonymous",
            "daily_limit": settings.ai_proxy_cost_limit_daily,
            "rate_limit_per_minute": settings.ai_proxy_rate_limit_per_minute,
            "rate_limit_per_hour": settings.ai_proxy_rate_limit_per_hour
        }
    
    try:
        # Get quota for each provider
        quotas = {}
        for provider in AIProvider:
            query = select(AIQuotaLimit).where(
                and_(
                    AIQuotaLimit.user_id == user_id,
                    AIQuotaLimit.provider == provider
                )
            )
            result = await db.execute(query)
            quota = result.scalar_one_or_none()
            
            if quota:
                quotas[provider.value] = {
                    "daily_limit": quota.daily_limit_usd,
                    "daily_spent": quota.daily_spent_usd,
                    "daily_remaining": max(0, quota.daily_limit_usd - quota.daily_spent_usd),
                    "monthly_limit": quota.monthly_limit_usd,
                    "monthly_spent": quota.monthly_spent_usd,
                    "monthly_remaining": max(0, quota.monthly_limit_usd - quota.monthly_spent_usd),
                    "daily_exceeded": quota.is_daily_exceeded,
                    "monthly_exceeded": quota.is_monthly_exceeded,
                    "daily_requests": quota.daily_requests,
                    "monthly_requests": quota.monthly_requests
                }
        
        return {
            "user_id": user_id,
            "quotas": quotas,
            "rate_limits": {
                "per_minute": settings.ai_proxy_rate_limit_per_minute,
                "per_hour": settings.ai_proxy_rate_limit_per_hour
            }
        }
        
    except Exception as e:
        logger.error(f"Quota retrieval error: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve quota information")

# Circuit Breaker Management
@router.post("/circuit-breaker/{provider}/reset")
async def reset_circuit_breaker(
    provider: str,
    db: AsyncSession = Depends(get_db)
):
    """Manually reset circuit breaker for a provider"""
    
    try:
        provider_enum = AIProvider(provider)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {provider}")
    
    try:
        query = select(AICircuitBreaker).where(AICircuitBreaker.provider == provider_enum)
        result = await db.execute(query)
        circuit_breaker = result.scalar_one_or_none()
        
        if circuit_breaker:
            circuit_breaker.state = "closed"
            circuit_breaker.failure_count = 0
            circuit_breaker.next_attempt_time = None
            circuit_breaker.updated_at = datetime.utcnow()
            await db.commit()
            
            logger.info(f"Circuit breaker reset for {provider}")
            return {"success": True, "message": f"Circuit breaker reset for {provider}"}
        else:
            return {"success": False, "message": f"No circuit breaker found for {provider}"}
            
    except Exception as e:
        logger.error(f"Circuit breaker reset error: {e}")
        raise HTTPException(status_code=500, detail="Failed to reset circuit breaker")

# Cache Management
@router.delete("/cache/clear")
async def clear_response_cache(
    provider: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    redis: Optional[AIORedis] = Depends(get_redis_client)
):
    """Clear response cache for specified provider or all providers"""
    
    try:
        # Clear Redis cache
        if redis:
            if provider:
                # Clear specific provider cache
                pattern = f"ai_cache:*{provider}*"
                keys = await redis.keys(pattern)
                if keys:
                    await redis.delete(*keys)
                    redis_cleared = len(keys)
                else:
                    redis_cleared = 0
            else:
                # Clear all AI cache
                keys = await redis.keys("ai_cache:*")
                if keys:
                    await redis.delete(*keys)
                    redis_cleared = len(keys)
                else:
                    redis_cleared = 0
        else:
            redis_cleared = 0
        
        # Clear database cache
        if provider:
            provider_enum = AIProvider(provider)
            await db.execute(
                select(AIResponseCache).where(AIResponseCache.provider == provider_enum)
            )
            db_result = await db.execute(
                "DELETE FROM ai_response_cache WHERE provider = :provider",
                {"provider": provider}
            )
        else:
            db_result = await db.execute("DELETE FROM ai_response_cache")
        
        await db.commit()
        
        return {
            "success": True,
            "redis_entries_cleared": redis_cleared,
            "database_entries_cleared": db_result.rowcount,
            "provider": provider or "all"
        }
        
    except Exception as e:
        logger.error(f"Cache clear error: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")

@router.post("/providers/{provider_id}/select")
async def select_ai_provider(provider_id: str):
    """Select an AI provider (legacy endpoint for compatibility)"""
    return {"success": True, "message": f"Selected AI provider: {provider_id}"}