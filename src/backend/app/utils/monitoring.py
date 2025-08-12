"""
Monitoring and Performance Tracking Utilities

Provides performance metrics collection and monitoring capabilities
for the PDF proxy service.
"""

import time
import logging
from typing import Dict, Any, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)


class PerformanceTracker:
    """Performance metrics tracker"""
    
    def __init__(self):
        self.metrics = {}
    
    def track_metric(self, name: str, value: float, tags: Optional[Dict[str, str]] = None):
        """Track a performance metric"""
        timestamp = time.time()
        
        metric_data = {
            'name': name,
            'value': value,
            'timestamp': timestamp,
            'tags': tags or {}
        }
        
        # Store in memory (in production, send to metrics system)
        if name not in self.metrics:
            self.metrics[name] = []
        
        self.metrics[name].append(metric_data)
        
        # Keep only recent metrics (last 1000 entries)
        if len(self.metrics[name]) > 1000:
            self.metrics[name] = self.metrics[name][-1000:]
    
    def get_metric_summary(self, name: str, window_minutes: int = 60) -> Dict[str, Any]:
        """Get summary statistics for a metric"""
        if name not in self.metrics:
            return {'count': 0, 'avg': 0, 'min': 0, 'max': 0}
        
        cutoff_time = time.time() - (window_minutes * 60)
        recent_values = [
            m['value'] for m in self.metrics[name] 
            if m['timestamp'] > cutoff_time
        ]
        
        if not recent_values:
            return {'count': 0, 'avg': 0, 'min': 0, 'max': 0}
        
        return {
            'count': len(recent_values),
            'avg': sum(recent_values) / len(recent_values),
            'min': min(recent_values),
            'max': max(recent_values)
        }


# Global performance tracker instance
_performance_tracker = PerformanceTracker()


async def track_performance_metric(
    name: str, 
    value: float, 
    tags: Optional[Dict[str, str]] = None
) -> None:
    """
    Track a performance metric.
    
    Args:
        name: Metric name (e.g., 'pdf_fetch_duration', 'pdf_cache_hit')
        value: Metric value
        tags: Optional tags for metric categorization
    """
    try:
        _performance_tracker.track_metric(name, value, tags)
        
        # Log significant metrics
        if name in ['pdf_fetch_duration', 'pdf_proxy_response_time']:
            if value > 5.0:  # Log slow requests
                logger.warning(f"SLOW_METRIC: {name}={value:.2f}s tags={tags}")
            else:
                logger.debug(f"METRIC: {name}={value:.2f}s tags={tags}")
        else:
            logger.debug(f"METRIC: {name}={value} tags={tags}")
        
        # Here you would typically send to monitoring system:
        # - Prometheus metrics
        # - StatsD/Graphite  
        # - DataDog metrics
        # - CloudWatch metrics
        # - Custom metrics endpoint
        
    except Exception as e:
        logger.error(f"Failed to track performance metric: {e}")


async def get_performance_summary() -> Dict[str, Any]:
    """Get performance summary for monitoring dashboard"""
    try:
        return {
            'pdf_fetch_duration': _performance_tracker.get_metric_summary('pdf_fetch_duration'),
            'pdf_proxy_response_time': _performance_tracker.get_metric_summary('pdf_proxy_response_time'),
            'pdf_cache_hit': _performance_tracker.get_metric_summary('pdf_cache_hit'),
            'pdf_cache_miss': _performance_tracker.get_metric_summary('pdf_cache_miss'),
            'timestamp': datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to get performance summary: {e}")
        return {}


class RequestTimer:
    """Context manager for timing requests"""
    
    def __init__(self, metric_name: str, tags: Optional[Dict[str, str]] = None):
        self.metric_name = metric_name
        self.tags = tags
        self.start_time = None
    
    async def __aenter__(self):
        self.start_time = time.time()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.start_time is not None:
            duration = time.time() - self.start_time
            await track_performance_metric(self.metric_name, duration, self.tags)


# Convenience function for timing operations
async def time_operation(operation_name: str, tags: Optional[Dict[str, str]] = None):
    """Returns a context manager for timing operations"""
    return RequestTimer(operation_name, tags)