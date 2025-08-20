import time
import logging
from collections import defaultdict
from typing import Dict, Counter
from datetime import datetime, timedelta
from uuid import UUID

logger = logging.getLogger(__name__)


class MetricsCollector:
    """Collect and track application metrics"""
    
    def __init__(self):
        # Connection metrics
        self.total_connections = 0
        self.active_connections = 0
        self.peak_connections = 0
        
        # Message metrics
        self.total_messages = 0
        self.messages_by_type: Counter[str] = Counter()
        self.messages_by_user: Dict[UUID, int] = defaultdict(int)
        
        # Error metrics
        self.total_errors = 0
        self.errors_by_type: Counter[str] = Counter()
        
        # Rate limiting metrics
        self.rate_limit_hits = 0
        self.rate_limit_hits_by_user: Dict[UUID, int] = defaultdict(int)
        
        # Performance metrics
        self.avg_message_processing_time = 0.0
        self.total_processing_time = 0.0
        self.message_count_for_avg = 0
        
        # Timestamp tracking
        self.start_time = datetime.utcnow()
        self.last_reset = datetime.utcnow()
        
        # Hourly/daily stats
        self.hourly_stats = defaultdict(lambda: {
            'connections': 0,
            'messages': 0,
            'errors': 0
        })
        self.daily_stats = defaultdict(lambda: {
            'connections': 0,
            'messages': 0,
            'errors': 0
        })
    
    def record_connection(self, user_id: UUID):
        """Record a new connection"""
        self.total_connections += 1
        self.active_connections += 1
        self.peak_connections = max(self.peak_connections, self.active_connections)
        
        # Update hourly/daily stats
        hour_key = datetime.utcnow().strftime('%Y-%m-%d %H:00')
        day_key = datetime.utcnow().strftime('%Y-%m-%d')
        
        self.hourly_stats[hour_key]['connections'] += 1
        self.daily_stats[day_key]['connections'] += 1
        
        logger.info(f"New connection from user {user_id}. Active: {self.active_connections}")
    
    def record_disconnection(self, user_id: UUID):
        """Record a disconnection"""
        self.active_connections = max(0, self.active_connections - 1)
        logger.info(f"Disconnection from user {user_id}. Active: {self.active_connections}")
    
    def record_message(self, user_id: UUID, message_type: str, processing_time: float = 0.0):
        """Record a message"""
        self.total_messages += 1
        self.messages_by_type[message_type] += 1
        self.messages_by_user[user_id] += 1
        
        # Update processing time average
        self.total_processing_time += processing_time
        self.message_count_for_avg += 1
        self.avg_message_processing_time = self.total_processing_time / self.message_count_for_avg
        
        # Update hourly/daily stats
        hour_key = datetime.utcnow().strftime('%Y-%m-%d %H:00')
        day_key = datetime.utcnow().strftime('%Y-%m-%d')
        
        self.hourly_stats[hour_key]['messages'] += 1
        self.daily_stats[day_key]['messages'] += 1
        
        logger.debug(f"Message from user {user_id}: {message_type} (processed in {processing_time:.3f}s)")
    
    def record_error(self, error_type: str, user_id: UUID = None):
        """Record an error"""
        self.total_errors += 1
        self.errors_by_type[error_type] += 1
        
        # Update hourly/daily stats
        hour_key = datetime.utcnow().strftime('%Y-%m-%d %H:00')
        day_key = datetime.utcnow().strftime('%Y-%m-%d')
        
        self.hourly_stats[hour_key]['errors'] += 1
        self.daily_stats[day_key]['errors'] += 1
        
        if user_id:
            logger.error(f"Error for user {user_id}: {error_type}")
        else:
            logger.error(f"System error: {error_type}")
    
    def record_rate_limit_hit(self, user_id: UUID):
        """Record a rate limit hit"""
        self.rate_limit_hits += 1
        self.rate_limit_hits_by_user[user_id] += 1
        logger.warning(f"Rate limit hit for user {user_id}")
    
    def get_current_stats(self) -> Dict:
        """Get current statistics"""
        uptime = datetime.utcnow() - self.start_time
        
        return {
            "uptime_seconds": uptime.total_seconds(),
            "connections": {
                "total": self.total_connections,
                "active": self.active_connections,
                "peak": self.peak_connections
            },
            "messages": {
                "total": self.total_messages,
                "by_type": dict(self.messages_by_type),
                "avg_processing_time": round(self.avg_message_processing_time, 3)
            },
            "errors": {
                "total": self.total_errors,
                "by_type": dict(self.errors_by_type)
            },
            "rate_limiting": {
                "total_hits": self.rate_limit_hits
            },
            "performance": {
                "messages_per_second": self._calculate_messages_per_second(),
                "connections_per_minute": self._calculate_connections_per_minute()
            }
        }
    
    def get_user_stats(self, user_id: UUID) -> Dict:
        """Get statistics for a specific user"""
        return {
            "messages_sent": self.messages_by_user.get(user_id, 0),
            "rate_limit_hits": self.rate_limit_hits_by_user.get(user_id, 0)
        }
    
    def get_hourly_stats(self, hours: int = 24) -> Dict:
        """Get hourly statistics for the last N hours"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        filtered_stats = {}
        
        for hour_key, stats in self.hourly_stats.items():
            hour_time = datetime.strptime(hour_key, '%Y-%m-%d %H:00')
            if hour_time >= cutoff_time:
                filtered_stats[hour_key] = stats
        
        return filtered_stats
    
    def get_daily_stats(self, days: int = 7) -> Dict:
        """Get daily statistics for the last N days"""
        cutoff_time = datetime.utcnow() - timedelta(days=days)
        filtered_stats = {}
        
        for day_key, stats in self.daily_stats.items():
            day_time = datetime.strptime(day_key, '%Y-%m-%d')
            if day_time >= cutoff_time:
                filtered_stats[day_key] = stats
        
        return filtered_stats
    
    def reset_stats(self):
        """Reset all statistics (useful for testing)"""
        self.total_connections = 0
        self.active_connections = 0
        self.peak_connections = 0
        self.total_messages = 0
        self.messages_by_type.clear()
        self.messages_by_user.clear()
        self.total_errors = 0
        self.errors_by_type.clear()
        self.rate_limit_hits = 0
        self.rate_limit_hits_by_user.clear()
        self.avg_message_processing_time = 0.0
        self.total_processing_time = 0.0
        self.message_count_for_avg = 0
        self.start_time = datetime.utcnow()
        self.last_reset = datetime.utcnow()
        self.hourly_stats.clear()
        self.daily_stats.clear()
        
        logger.info("Metrics reset")
    
    def _calculate_messages_per_second(self) -> float:
        """Calculate messages per second over the last minute"""
        if self.message_count_for_avg == 0:
            return 0.0
        
        uptime_seconds = (datetime.utcnow() - self.start_time).total_seconds()
        if uptime_seconds == 0:
            return 0.0
        
        return round(self.total_messages / uptime_seconds, 2)
    
    def _calculate_connections_per_minute(self) -> float:
        """Calculate connections per minute over the last hour"""
        uptime_minutes = (datetime.utcnow() - self.start_time).total_seconds() / 60
        if uptime_minutes == 0:
            return 0.0
        
        return round(self.total_connections / uptime_minutes, 2)


# Global metrics collector instance
metrics = MetricsCollector()
