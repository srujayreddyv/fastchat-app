import pytest
from app.metrics import MetricsCollector
import uuid
from datetime import datetime, timedelta

@pytest.fixture
def metrics_collector():
    """Create a fresh metrics collector for each test"""
    return MetricsCollector()

def test_metrics_initialization(metrics_collector):
    """Test metrics collector initialization"""
    assert metrics_collector.total_connections == 0
    assert metrics_collector.active_connections == 0
    assert metrics_collector.total_messages == 0
    assert metrics_collector.total_errors == 0

def test_record_connection(metrics_collector):
    """Test recording connections"""
    user_id = uuid.uuid4()
    
    metrics_collector.record_connection(user_id)
    
    assert metrics_collector.total_connections == 1
    assert metrics_collector.active_connections == 1
    assert metrics_collector.peak_connections == 1

def test_record_disconnection(metrics_collector):
    """Test recording disconnections"""
    user_id = uuid.uuid4()
    
    # Connect first
    metrics_collector.record_connection(user_id)
    assert metrics_collector.active_connections == 1
    
    # Then disconnect
    metrics_collector.record_disconnection(user_id)
    assert metrics_collector.active_connections == 0
    assert metrics_collector.total_connections == 1

def test_record_message(metrics_collector):
    """Test recording messages"""
    user_id = uuid.uuid4()
    
    metrics_collector.record_message(user_id, "MSG", 0.1)
    metrics_collector.record_message(user_id, "TYPING", 0.05)
    
    assert metrics_collector.total_messages == 2
    assert metrics_collector.messages_by_type["MSG"] == 1
    assert metrics_collector.messages_by_type["TYPING"] == 1
    assert metrics_collector.messages_by_user[user_id] == 2

def test_record_error(metrics_collector):
    """Test recording errors"""
    user_id = uuid.uuid4()
    
    metrics_collector.record_error("VALIDATION_ERROR", user_id)
    metrics_collector.record_error("SYSTEM_ERROR")
    
    assert metrics_collector.total_errors == 2
    assert metrics_collector.errors_by_type["VALIDATION_ERROR"] == 1
    assert metrics_collector.errors_by_type["SYSTEM_ERROR"] == 1

def test_record_rate_limit_hit(metrics_collector):
    """Test recording rate limit hits"""
    user_id = uuid.uuid4()
    
    metrics_collector.record_rate_limit_hit(user_id)
    metrics_collector.record_rate_limit_hit(user_id)
    
    assert metrics_collector.rate_limit_hits == 2
    assert metrics_collector.rate_limit_hits_by_user[user_id] == 2

def test_get_current_stats(metrics_collector):
    """Test getting current statistics"""
    user_id = uuid.uuid4()
    
    # Add some data
    metrics_collector.record_connection(user_id)
    metrics_collector.record_message(user_id, "MSG", 0.1)
    metrics_collector.record_error("TEST_ERROR", user_id)
    metrics_collector.record_rate_limit_hit(user_id)
    
    stats = metrics_collector.get_current_stats()
    
    assert stats["connections"]["total"] == 1
    assert stats["connections"]["active"] == 1
    assert stats["messages"]["total"] == 1
    assert stats["errors"]["total"] == 1
    assert stats["rate_limiting"]["total_hits"] == 1
    assert "uptime_seconds" in stats
    assert "performance" in stats

def test_get_user_stats(metrics_collector):
    """Test getting user-specific statistics"""
    user_id = uuid.uuid4()
    
    # Add some user data
    metrics_collector.record_message(user_id, "MSG", 0.1)
    metrics_collector.record_message(user_id, "TYPING", 0.05)
    metrics_collector.record_rate_limit_hit(user_id)
    
    stats = metrics_collector.get_user_stats(user_id)
    
    assert stats["messages_sent"] == 2
    assert stats["rate_limit_hits"] == 1

def test_get_hourly_stats(metrics_collector):
    """Test getting hourly statistics"""
    user_id = uuid.uuid4()
    
    # Add some data
    metrics_collector.record_connection(user_id)
    metrics_collector.record_message(user_id, "MSG", 0.1)
    metrics_collector.record_error("TEST_ERROR", user_id)
    
    hourly_stats = metrics_collector.get_hourly_stats(1)
    
    # Should have at least one hour of data
    assert len(hourly_stats) >= 1
    
    # Check structure of hourly data
    for hour_data in hourly_stats.values():
        assert "connections" in hour_data
        assert "messages" in hour_data
        assert "errors" in hour_data

def test_get_daily_stats(metrics_collector):
    """Test getting daily statistics"""
    user_id = uuid.uuid4()
    
    # Add some data
    metrics_collector.record_connection(user_id)
    metrics_collector.record_message(user_id, "MSG", 0.1)
    metrics_collector.record_error("TEST_ERROR", user_id)
    
    daily_stats = metrics_collector.get_daily_stats(1)
    
    # Should have at least one day of data
    assert len(daily_stats) >= 1
    
    # Check structure of daily data
    for day_data in daily_stats.values():
        assert "connections" in day_data
        assert "messages" in day_data
        assert "errors" in day_data

def test_reset_stats(metrics_collector):
    """Test resetting statistics"""
    user_id = uuid.uuid4()
    
    # Add some data
    metrics_collector.record_connection(user_id)
    metrics_collector.record_message(user_id, "MSG", 0.1)
    metrics_collector.record_error("TEST_ERROR", user_id)
    metrics_collector.record_rate_limit_hit(user_id)
    
    # Reset
    metrics_collector.reset_stats()
    
    # Check everything is reset
    assert metrics_collector.total_connections == 0
    assert metrics_collector.active_connections == 0
    assert metrics_collector.total_messages == 0
    assert metrics_collector.total_errors == 0
    assert metrics_collector.rate_limit_hits == 0
    assert len(metrics_collector.messages_by_type) == 0
    assert len(metrics_collector.errors_by_type) == 0

def test_avg_processing_time_calculation(metrics_collector):
    """Test average processing time calculation"""
    user_id = uuid.uuid4()
    
    # Add messages with different processing times
    metrics_collector.record_message(user_id, "MSG", 0.1)
    metrics_collector.record_message(user_id, "MSG", 0.3)
    metrics_collector.record_message(user_id, "MSG", 0.2)
    
    # Average should be (0.1 + 0.3 + 0.2) / 3 = 0.2
    assert abs(metrics_collector.avg_message_processing_time - 0.2) < 0.001

def test_peak_connections_tracking(metrics_collector):
    """Test peak connections tracking"""
    user1 = uuid.uuid4()
    user2 = uuid.uuid4()
    user3 = uuid.uuid4()
    
    # Connect users one by one
    metrics_collector.record_connection(user1)
    assert metrics_collector.peak_connections == 1
    
    metrics_collector.record_connection(user2)
    assert metrics_collector.peak_connections == 2
    
    metrics_collector.record_connection(user3)
    assert metrics_collector.peak_connections == 3
    
    # Disconnect one user
    metrics_collector.record_disconnection(user1)
    assert metrics_collector.peak_connections == 3  # Peak should remain at 3
    assert metrics_collector.active_connections == 2
