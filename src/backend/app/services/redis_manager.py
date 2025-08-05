"""
Redis Connection Manager with Connection Pooling, Health Monitoring, and Failover.
Production-ready Redis client with comprehensive error handling and monitoring.
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Union
from redis.asyncio import Redis, ConnectionPool
from redis.exceptions import ConnectionError, TimeoutError, RedisError
import hashlib

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RedisHealthMonitor:
    """Health monitoring for Redis connections"""
    
    def __init__(self, redis_client: Redis):
        self.redis_client = redis_client
        self.last_health_check = None
        self.consecutive_failures = 0
        self.max_failures = 3
        self.health_check_interval = 30  # seconds
        
    async def health_check(self) -> bool:
        """Perform health check on Redis connection"""
        try:
            # Simple ping test
            await self.redis_client.ping()
            
            # Test basic operations
            test_key = f"health_check:{datetime.utcnow().isoformat()}"
            await self.redis_client.set(test_key, "ok", ex=10)
            result = await self.redis_client.get(test_key)
            await self.redis_client.delete(test_key)
            
            if result == b"ok":
                self.consecutive_failures = 0
                self.last_health_check = datetime.utcnow()
                return True
            else:
                self.consecutive_failures += 1
                return False
                
        except Exception as e:
            logger.warning(f"Redis health check failed: {e}")
            self.consecutive_failures += 1
            return False
    
    def is_healthy(self) -> bool:
        """Check if Redis is considered healthy"""
        return self.consecutive_failures < self.max_failures
    
    def needs_health_check(self) -> bool:
        """Check if health check is needed"""
        if not self.last_health_check:
            return True
        return datetime.utcnow() - self.last_health_check > timedelta(seconds=self.health_check_interval)


class RedisConnectionManager:
    """
    Production-ready Redis connection manager with:
    - Connection pooling
    - Health monitoring
    - Automatic failover
    - Circuit breaker pattern
    - Comprehensive error handling
    """
    
    def __init__(self):
        self.settings = get_settings()
        self.redis_client: Optional[Redis] = None
        self.health_monitor: Optional[RedisHealthMonitor] = None
        self.connection_lock = asyncio.Lock()
        self.is_connected = False
        self.circuit_open = False
        self.circuit_failures = 0
        self.circuit_last_failure = None
        self.circuit_threshold = 5
        self.circuit_timeout = 60  # seconds
        
    async def initialize(self) -> bool:
        """Initialize Redis connection with proper error handling"""
        if not self.settings.redis_enabled:
            logger.info("Redis is disabled in configuration")
            return False
            
        async with self.connection_lock:
            try:
                if self.redis_client:
                    await self.close()
                
                # Create Redis connection with configuration
                self.redis_client = redis.asyncio.from_url(
                    self.settings.redis_url,
                    max_connections=self.settings.redis_max_connections,
                    retry_on_timeout=True,
                    retry_on_error=[ConnectionError, TimeoutError],
                    socket_connect_timeout=5,
                    socket_timeout=10,
                    health_check_interval=30,
                    encoding="utf-8",
                    decode_responses=True
                )
                
                # Test connection
                await self.redis_client.ping()
                
                # Initialize health monitor
                self.health_monitor = RedisHealthMonitor(self.redis_client)
                
                self.is_connected = True
                self.circuit_open = False
                self.circuit_failures = 0
                
                logger.info(f"Redis connection established: {self.settings.redis_url}")
                return True
                
            except Exception as e:
                logger.error(f"Failed to initialize Redis connection: {e}")
                self.is_connected = False
                self._record_circuit_breaker_failure()
                return False
    
    async def get_client(self) -> Optional[Redis]:
        """Get Redis client with health check and circuit breaker"""
        if self.circuit_open:
            if self._should_attempt_reset():
                logger.info("Attempting to reset Redis circuit breaker")
                success = await self.initialize()
                if not success:
                    return None
            else:
                return None
        
        if not self.is_connected or not self.redis_client:
            success = await self.initialize()
            if not success:
                return None
        
        # Periodic health check
        if self.health_monitor and self.health_monitor.needs_health_check():
            healthy = await self.health_monitor.health_check()
            if not healthy:
                logger.warning("Redis health check failed, attempting reconnection")
                success = await self.initialize()
                if not success:
                    return None
        
        return self.redis_client
    
    def _record_circuit_breaker_failure(self):
        """Record circuit breaker failure"""
        self.circuit_failures += 1
        self.circuit_last_failure = datetime.utcnow()
        
        if self.circuit_failures >= self.circuit_threshold:
            self.circuit_open = True
            logger.warning(f"Redis circuit breaker opened after {self.circuit_failures} failures")
    
    def _should_attempt_reset(self) -> bool:
        """Check if circuit breaker should attempt reset"""
        if not self.circuit_open or not self.circuit_last_failure:
            return False
        
        time_since_failure = datetime.utcnow() - self.circuit_last_failure
        return time_since_failure.total_seconds() > self.circuit_timeout
    
    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            try:
                await self.redis_client.close()
            except Exception as e:
                logger.error(f"Error closing Redis connection: {e}")
            finally:
                self.redis_client = None
                self.is_connected = False
                self.health_monitor = None
    
    @asynccontextmanager
    async def get_connection(self):
        """Context manager for Redis operations with automatic error handling"""
        client = await self.get_client()
        if not client:
            raise RedisError("Redis connection not available")
        
        try:
            yield client
        except Exception as e:
            logger.error(f"Redis operation failed: {e}")
            self._record_circuit_breaker_failure()
            raise
    
    # High-level Redis operations with error handling
    async def get(self, key: str) -> Optional[str]:
        """Get value from Redis with error handling"""
        try:
            async with self.get_connection() as redis:
                return await redis.get(key)
        except Exception as e:
            logger.warning(f"Redis GET failed for key {key}: {e}")
            return None
    
    async def set(
        self, 
        key: str, 
        value: Union[str, int, float, dict, list], 
        ex: Optional[int] = None
    ) -> bool:
        """Set value in Redis with error handling"""
        try:
            async with self.get_connection() as redis:
                if isinstance(value, (dict, list)):
                    value = json.dumps(value)
                elif not isinstance(value, str):
                    value = str(value)
                
                await redis.set(key, value, ex=ex)
                return True
        except Exception as e:
            logger.warning(f"Redis SET failed for key {key}: {e}")
            return False
    
    async def delete(self, *keys: str) -> int:
        """Delete keys from Redis with error handling"""
        try:
            async with self.get_connection() as redis:
                return await redis.delete(*keys)
        except Exception as e:
            logger.warning(f"Redis DELETE failed for keys {keys}: {e}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis"""
        try:
            async with self.get_connection() as redis:
                return bool(await redis.exists(key))
        except Exception as e:
            logger.warning(f"Redis EXISTS failed for key {key}: {e}")
            return False
    
    async def expire(self, key: str, seconds: int) -> bool:
        """Set expiration for key"""
        try:
            async with self.get_connection() as redis:
                return bool(await redis.expire(key, seconds))
        except Exception as e:
            logger.warning(f"Redis EXPIRE failed for key {key}: {e}")
            return False
    
    async def incr(self, key: str) -> Optional[int]:
        """Increment key value"""
        try:
            async with self.get_connection() as redis:
                return await redis.incr(key)
        except Exception as e:
            logger.warning(f"Redis INCR failed for key {key}: {e}")
            return None
    
    async def keys(self, pattern: str) -> List[str]:
        """Get keys matching pattern"""
        try:
            async with self.get_connection() as redis:
                return await redis.keys(pattern)
        except Exception as e:
            logger.warning(f"Redis KEYS failed for pattern {pattern}: {e}")
            return []
    
    async def ping(self) -> bool:
        """Ping Redis server"""
        try:
            async with self.get_connection() as redis:
                await redis.ping()
                return True
        except Exception as e:
            logger.warning(f"Redis PING failed: {e}")
            return False
    
    # Cache-specific operations
    async def cache_get(self, key: str) -> Optional[Dict[str, Any]]:
        """Get cached data as JSON"""
        try:
            data = await self.get(key)
            if data:
                return json.loads(data)
        except (json.JSONDecodeError, Exception) as e:
            logger.warning(f"Cache GET JSON decode failed for key {key}: {e}")
        return None
    
    async def cache_set(
        self, 
        key: str, 
        data: Dict[str, Any], 
        ttl: int = 3600
    ) -> bool:
        """Set cached data as JSON with TTL"""
        try:
            json_data = json.dumps(data, default=str)
            return await self.set(key, json_data, ex=ttl)
        except Exception as e:
            logger.warning(f"Cache SET failed for key {key}: {e}")
            return False
    
    # Rate limiting operations
    async def rate_limit_check(
        self, 
        identifier: str, 
        limit: int, 
        window_seconds: int
    ) -> Dict[str, Any]:
        """Check rate limit using sliding window"""
        try:
            async with self.get_connection() as redis:
                now = datetime.utcnow().timestamp()
                window_start = now - window_seconds
                
                # Remove old entries
                await redis.zremrangebyscore(identifier, 0, window_start)
                
                # Count current requests
                current_count = await redis.zcard(identifier)
                
                if current_count >= limit:
                    # Get oldest request time for reset calculation
                    oldest = await redis.zrange(identifier, 0, 0, withscores=True)
                    reset_time = int(oldest[0][1] + window_seconds) if oldest else int(now + window_seconds)
                    
                    return {
                        "allowed": False,
                        "count": current_count,
                        "limit": limit,
                        "remaining": 0,
                        "reset_time": reset_time
                    }
                
                # Add current request
                await redis.zadd(identifier, {str(now): now})
                await redis.expire(identifier, window_seconds)
                
                return {
                    "allowed": True,
                    "count": current_count + 1,
                    "limit": limit,
                    "remaining": limit - current_count - 1,
                    "reset_time": int(now + window_seconds)
                }
                
        except Exception as e:
            logger.error(f"Rate limit check failed for {identifier}: {e}")
            # Fail open - allow request but log error
            return {
                "allowed": True,
                "count": 0,
                "limit": limit,
                "remaining": limit,
                "reset_time": int(datetime.utcnow().timestamp() + window_seconds),
                "error": str(e)
            }
    
    async def get_connection_info(self) -> Dict[str, Any]:
        """Get Redis connection information"""
        return {
            "enabled": self.settings.redis_enabled,
            "connected": self.is_connected,
            "circuit_open": self.circuit_open,
            "circuit_failures": self.circuit_failures,
            "last_failure": self.circuit_last_failure.isoformat() if self.circuit_last_failure else None,
            "url": self.settings.redis_url.replace(r"redis://[^@]*@", "redis://***@") if self.settings.redis_url else None,
            "max_connections": self.settings.redis_max_connections,
            "health_status": "healthy" if self.health_monitor and self.health_monitor.is_healthy() else "unhealthy"
        }


# Global Redis manager instance
redis_manager = RedisConnectionManager()


async def get_redis_manager() -> RedisConnectionManager:
    """Get the global Redis manager instance"""
    return redis_manager


async def get_redis_client() -> Optional[Redis]:
    """Get Redis client (FastAPI dependency)"""
    return await redis_manager.get_client()


# Startup and shutdown handlers
async def initialize_redis():
    """Initialize Redis connection on startup"""
    if settings.redis_enabled:
        success = await redis_manager.initialize()
        if success:
            logger.info("Redis initialized successfully")
        else:
            logger.warning("Redis initialization failed - running without Redis")
    else:
        logger.info("Redis disabled in configuration")


async def shutdown_redis():
    """Close Redis connection on shutdown"""
    await redis_manager.close()
    logger.info("Redis connections closed")