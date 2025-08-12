"""
Rate Limiter Utility

Implements Redis-based rate limiting with sliding window algorithm
for PDF proxy security and abuse prevention.
"""

import time
import logging
from typing import Optional

import redis.asyncio as redis
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RateLimiter:
    """Redis-based rate limiter with sliding window"""
    
    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.REDIS_URL or "redis://localhost:6379"
        self._redis = None
    
    async def _get_redis(self):
        """Get Redis connection"""
        if self._redis is None:
            self._redis = redis.from_url(self.redis_url)
        return self._redis
    
    async def check_limit(
        self, 
        identifier: str, 
        limit: int, 
        window_seconds: int = 3600
    ) -> bool:
        """
        Check if request is within rate limit using sliding window.
        
        Args:
            identifier: Unique identifier (user_id, IP, etc.)
            limit: Maximum number of requests allowed
            window_seconds: Time window in seconds (default: 1 hour)
        
        Returns:
            bool: True if within limit, False if rate limited
        """
        try:
            redis_conn = await self._get_redis()
            current_time = int(time.time())
            window_start = current_time - window_seconds
            
            # Redis key for this identifier
            key = f"rate_limit:{identifier}"
            
            # Use Redis pipeline for atomic operations
            pipe = redis_conn.pipeline()
            
            # Remove old entries outside the window
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current requests in window
            pipe.zcard(key)
            
            # Add current request
            pipe.zadd(key, {str(current_time): current_time})
            
            # Set expiry on key
            pipe.expire(key, window_seconds)
            
            # Execute pipeline
            results = await pipe.execute()
            current_count = results[1]  # Result of zcard
            
            # Check if within limit
            within_limit = current_count < limit
            
            if not within_limit:
                logger.warning(f"Rate limit exceeded for {identifier}: {current_count}/{limit}")
            
            return within_limit
            
        except Exception as e:
            logger.error(f"Rate limiter error: {e}")
            # Fail open - allow request if rate limiter fails
            return True
    
    async def get_current_usage(self, identifier: str, window_seconds: int = 3600) -> int:
        """Get current usage count for an identifier"""
        try:
            redis_conn = await self._get_redis()
            current_time = int(time.time())
            window_start = current_time - window_seconds
            
            key = f"rate_limit:{identifier}"
            
            # Clean old entries and get count
            await redis_conn.zremrangebyscore(key, 0, window_start)
            count = await redis_conn.zcard(key)
            
            return count
            
        except Exception as e:
            logger.error(f"Rate limiter usage check error: {e}")
            return 0
    
    async def reset_limit(self, identifier: str) -> bool:
        """Reset rate limit for an identifier (admin function)"""
        try:
            redis_conn = await self._get_redis()
            key = f"rate_limit:{identifier}"
            await redis_conn.delete(key)
            logger.info(f"Rate limit reset for {identifier}")
            return True
        except Exception as e:
            logger.error(f"Rate limiter reset error: {e}")
            return False