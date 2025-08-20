import time
import logging
from collections import defaultdict, deque
from typing import Dict, Deque
from uuid import UUID

logger = logging.getLogger(__name__)


class RateLimiter:
    """Simple rate limiter for WebSocket messages"""
    
    def __init__(self):
        # Rate limits (messages per minute)
        self.message_limit = 60  # messages per minute
        self.typing_limit = 10   # typing indicators per minute
        self.ping_limit = 30     # pings per minute
        
        # Store message timestamps for each user
        self.message_timestamps: Dict[UUID, Deque[float]] = defaultdict(lambda: deque())
        self.typing_timestamps: Dict[UUID, Deque[float]] = defaultdict(lambda: deque())
        self.ping_timestamps: Dict[UUID, Deque[float]] = defaultdict(lambda: deque())
        
        # Cleanup interval (clean old timestamps every 5 minutes)
        self.last_cleanup = time.time()
        self.cleanup_interval = 300  # 5 minutes
    
    def _cleanup_old_timestamps(self):
        """Remove timestamps older than 1 minute"""
        current_time = time.time()
        cutoff_time = current_time - 60  # 1 minute ago
        
        # Cleanup message timestamps
        for user_id in list(self.message_timestamps.keys()):
            while (self.message_timestamps[user_id] and 
                   self.message_timestamps[user_id][0] < cutoff_time):
                self.message_timestamps[user_id].popleft()
            if not self.message_timestamps[user_id]:
                del self.message_timestamps[user_id]
        
        # Cleanup typing timestamps
        for user_id in list(self.typing_timestamps.keys()):
            while (self.typing_timestamps[user_id] and 
                   self.typing_timestamps[user_id][0] < cutoff_time):
                self.typing_timestamps[user_id].popleft()
            if not self.typing_timestamps[user_id]:
                del self.typing_timestamps[user_id]
        
        # Cleanup ping timestamps
        for user_id in list(self.ping_timestamps.keys()):
            while (self.ping_timestamps[user_id] and 
                   self.ping_timestamps[user_id][0] < cutoff_time):
                self.ping_timestamps[user_id].popleft()
            if not self.ping_timestamps[user_id]:
                del self.ping_timestamps[user_id]
        
        self.last_cleanup = current_time
    
    def check_rate_limit(self, user_id: UUID, message_type: str) -> bool:
        """
        Check if user is within rate limits for the given message type
        
        Returns:
            bool: True if within limits, False if rate limited
        """
        current_time = time.time()
        
        # Periodic cleanup
        if current_time - self.last_cleanup > self.cleanup_interval:
            self._cleanup_old_timestamps()
        
        if message_type == "MSG":
            # Check message rate limit
            timestamps = self.message_timestamps[user_id]
            if len(timestamps) >= self.message_limit:
                logger.warning(f"User {user_id} rate limited for messages")
                return False
            
            timestamps.append(current_time)
            return True
            
        elif message_type == "TYPING":
            # Check typing rate limit
            timestamps = self.typing_timestamps[user_id]
            if len(timestamps) >= self.typing_limit:
                logger.warning(f"User {user_id} rate limited for typing indicators")
                return False
            
            timestamps.append(current_time)
            return True
            
        elif message_type == "PING":
            # Check ping rate limit
            timestamps = self.ping_timestamps[user_id]
            if len(timestamps) >= self.ping_limit:
                logger.warning(f"User {user_id} rate limited for pings")
                return False
            
            timestamps.append(current_time)
            return True
        
        # Allow other message types (HELLO, OPEN_CHAT, etc.)
        return True
    
    def get_rate_limit_info(self, user_id: UUID) -> Dict[str, int]:
        """Get current rate limit usage for a user"""
        current_time = time.time()
        cutoff_time = current_time - 60
        
        # Count recent messages
        message_count = sum(1 for ts in self.message_timestamps[user_id] 
                           if ts > cutoff_time)
        
        # Count recent typing indicators
        typing_count = sum(1 for ts in self.typing_timestamps[user_id] 
                          if ts > cutoff_time)
        
        # Count recent pings
        ping_count = sum(1 for ts in self.ping_timestamps[user_id] 
                        if ts > cutoff_time)
        
        return {
            "messages": message_count,
            "typing": typing_count,
            "pings": ping_count,
            "message_limit": self.message_limit,
            "typing_limit": self.typing_limit,
            "ping_limit": self.ping_limit
        }
    
    def reset_user_limits(self, user_id: UUID):
        """Reset rate limits for a user (e.g., on disconnect)"""
        if user_id in self.message_timestamps:
            del self.message_timestamps[user_id]
        if user_id in self.typing_timestamps:
            del self.typing_timestamps[user_id]
        if user_id in self.ping_timestamps:
            del self.ping_timestamps[user_id]


# Global rate limiter instance
rate_limiter = RateLimiter()
