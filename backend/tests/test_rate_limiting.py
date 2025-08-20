import pytest
import time
from app.rate_limiter import RateLimiter
import uuid

@pytest.fixture
def rate_limiter():
    """Create a fresh rate limiter for each test"""
    return RateLimiter()

def test_rate_limiter_initialization(rate_limiter):
    """Test rate limiter initialization"""
    assert rate_limiter.message_limit == 60
    assert rate_limiter.typing_limit == 10
    assert rate_limiter.ping_limit == 30

def test_message_rate_limit(rate_limiter):
    """Test message rate limiting"""
    user_id = uuid.uuid4()
    
    # Send messages up to the limit
    for i in range(60):
        assert rate_limiter.check_rate_limit(user_id, "MSG") is True
    
    # 61st message should be rate limited
    assert rate_limiter.check_rate_limit(user_id, "MSG") is False

def test_typing_rate_limit(rate_limiter):
    """Test typing indicator rate limiting"""
    user_id = uuid.uuid4()
    
    # Send typing indicators up to the limit
    for i in range(10):
        assert rate_limiter.check_rate_limit(user_id, "TYPING") is True
    
    # 11th typing indicator should be rate limited
    assert rate_limiter.check_rate_limit(user_id, "TYPING") is False

def test_ping_rate_limit(rate_limiter):
    """Test ping rate limiting"""
    user_id = uuid.uuid4()
    
    # Send pings up to the limit
    for i in range(30):
        assert rate_limiter.check_rate_limit(user_id, "PING") is True
    
    # 31st ping should be rate limited
    assert rate_limiter.check_rate_limit(user_id, "PING") is False

def test_different_message_types_dont_interfere(rate_limiter):
    """Test that different message types have separate limits"""
    user_id = uuid.uuid4()
    
    # Send max messages
    for i in range(60):
        assert rate_limiter.check_rate_limit(user_id, "MSG") is True
    
    # Should still be able to send typing indicators
    for i in range(10):
        assert rate_limiter.check_rate_limit(user_id, "TYPING") is True
    
    # Should still be able to send pings
    for i in range(30):
        assert rate_limiter.check_rate_limit(user_id, "PING") is True

def test_other_message_types_not_limited(rate_limiter):
    """Test that other message types are not rate limited"""
    user_id = uuid.uuid4()
    
    # These should never be rate limited
    assert rate_limiter.check_rate_limit(user_id, "HELLO") is True
    assert rate_limiter.check_rate_limit(user_id, "OPEN_CHAT") is True
    assert rate_limiter.check_rate_limit(user_id, "UNKNOWN") is True

def test_rate_limit_info(rate_limiter):
    """Test rate limit info retrieval"""
    user_id = uuid.uuid4()
    
    # Send some messages
    for i in range(5):
        rate_limiter.check_rate_limit(user_id, "MSG")
    
    for i in range(3):
        rate_limiter.check_rate_limit(user_id, "TYPING")
    
    info = rate_limiter.get_rate_limit_info(user_id)
    
    assert info["messages"] == 5
    assert info["typing"] == 3
    assert info["pings"] == 0
    assert info["message_limit"] == 60
    assert info["typing_limit"] == 10
    assert info["ping_limit"] == 30

def test_reset_user_limits(rate_limiter):
    """Test resetting user rate limits"""
    user_id = uuid.uuid4()
    
    # Send some messages
    for i in range(10):
        rate_limiter.check_rate_limit(user_id, "MSG")
    
    # Reset limits
    rate_limiter.reset_user_limits(user_id)
    
    # Should be able to send messages again
    assert rate_limiter.check_rate_limit(user_id, "MSG") is True
    
    # Info should show 0 messages
    info = rate_limiter.get_rate_limit_info(user_id)
    assert info["messages"] == 0

def test_cleanup_old_timestamps(rate_limiter):
    """Test cleanup of old timestamps"""
    user_id = uuid.uuid4()
    
    # Send a message
    rate_limiter.check_rate_limit(user_id, "MSG")
    
    # Manually set old timestamp (simulate time passing)
    old_timestamp = time.time() - 120  # 2 minutes ago
    rate_limiter.message_timestamps[user_id].appendleft(old_timestamp)
    
    # Force cleanup
    rate_limiter._cleanup_old_timestamps()
    
    # Should only have the recent message
    info = rate_limiter.get_rate_limit_info(user_id)
    assert info["messages"] == 1
