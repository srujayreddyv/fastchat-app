import pytest
import json
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.websocket_manager import ConnectionManager
import uuid

class MockWebSocket:
    """Mock WebSocket for testing"""
    def __init__(self):
        self.sent_messages = []
        self.closed = False
    
    async def send_text(self, message: str):
        self.sent_messages.append(json.loads(message))
    
    async def receive_text(self):
        # This would be overridden in actual tests
        pass
    
    async def close(self):
        self.closed = True

@pytest.mark.asyncio
async def test_websocket_connection_manager(connection_manager: ConnectionManager):
    """Test WebSocket connection manager basic functionality"""
    user_id = uuid.uuid4()
    display_name = "Test User"
    mock_ws = MockWebSocket()
    
    # Test connection
    await connection_manager.connect(mock_ws, user_id, display_name)
    assert user_id in connection_manager.active_connections
    assert user_id in connection_manager.user_info
    assert connection_manager.user_info[user_id] == display_name
    
    # Test disconnect
    await connection_manager.disconnect(user_id)
    assert user_id not in connection_manager.active_connections
    assert user_id not in connection_manager.user_info

@pytest.mark.asyncio
async def test_websocket_hello_message(connection_manager: ConnectionManager):
    """Test HELLO message handling"""
    user_id = uuid.uuid4()
    display_name = "Test User"
    mock_ws = MockWebSocket()
    
    # Connect user
    await connection_manager.connect(mock_ws, user_id, display_name)
    
    # Test HELLO message
    hello_data = {
        "type": "HELLO",
        "user_id": str(user_id),
        "display_name": display_name
    }
    
    response = await connection_manager.handle_message(mock_ws, hello_data)
    # HELLO should not return a response (handled in router)
    assert response is None

@pytest.mark.asyncio
async def test_websocket_open_chat(connection_manager: ConnectionManager):
    """Test OPEN_CHAT message handling"""
    user1_id = uuid.uuid4()
    user2_id = uuid.uuid4()
    mock_ws1 = MockWebSocket()
    mock_ws2 = MockWebSocket()
    
    # Connect both users
    await connection_manager.connect(mock_ws1, user1_id, "User 1")
    await connection_manager.connect(mock_ws2, user2_id, "User 2")
    
    # Test OPEN_CHAT message
    open_chat_data = {
        "type": "OPEN_CHAT",
        "target_user_id": str(user2_id),
        "target_display_name": "User 2"
    }
    
    response = await connection_manager.handle_message(mock_ws1, open_chat_data)
    assert response is None
    
    # Check that chat was created
    assert len(connection_manager.chat_sessions) > 0
    # Both users should receive CHAT_OPENED message
    assert len(mock_ws1.sent_messages) > 0
    assert len(mock_ws2.sent_messages) > 0

@pytest.mark.asyncio
async def test_websocket_typing_indicator(connection_manager: ConnectionManager):
    """Test typing indicator functionality"""
    user1_id = uuid.uuid4()
    user2_id = uuid.uuid4()
    mock_ws1 = MockWebSocket()
    mock_ws2 = MockWebSocket()
    
    # Connect both users
    await connection_manager.connect(mock_ws1, user1_id, "User 1")
    await connection_manager.connect(mock_ws2, user2_id, "User 2")
    
    # Create a chat session
    chat_id = uuid.uuid4()
    connection_manager.chat_sessions[chat_id] = {user1_id, user2_id}
    connection_manager.user_chats[user1_id] = chat_id
    connection_manager.user_chats[user2_id] = chat_id
    
    # Test typing indicator
    typing_data = {
        "type": "TYPING",
        "chat_id": str(chat_id),
        "is_typing": True
    }
    
    response = await connection_manager.handle_message(mock_ws1, typing_data)
    assert response is None
    
    # Check that typing indicator was set
    assert chat_id in connection_manager.typing_users
    assert user1_id in connection_manager.typing_users[chat_id]
    
    # Check that other user received typing indicator
    assert len(mock_ws2.sent_messages) > 0
    typing_message = mock_ws2.sent_messages[-1]
    assert typing_message["type"] == "TYPING"
    assert typing_message["is_typing"] is True

@pytest.mark.asyncio
async def test_websocket_chat_message(connection_manager: ConnectionManager):
    """Test chat message handling"""
    user1_id = uuid.uuid4()
    user2_id = uuid.uuid4()
    mock_ws1 = MockWebSocket()
    mock_ws2 = MockWebSocket()
    
    # Connect both users
    await connection_manager.connect(mock_ws1, user1_id, "User 1")
    await connection_manager.connect(mock_ws2, user2_id, "User 2")
    
    # Create a chat session
    chat_id = uuid.uuid4()
    connection_manager.chat_sessions[chat_id] = {user1_id, user2_id}
    connection_manager.user_chats[user1_id] = chat_id
    connection_manager.user_chats[user2_id] = chat_id
    
    # Test chat message
    message_data = {
        "type": "MSG",
        "chat_id": str(chat_id),
        "content": "Hello, World!",
        "timestamp": "2024-01-01T12:00:00Z"
    }
    
    response = await connection_manager.handle_message(mock_ws1, message_data)
    assert response is None
    
    # Check that other user received the message
    assert len(mock_ws2.sent_messages) > 0
    received_message = mock_ws2.sent_messages[-1]
    assert received_message["type"] == "MSG"
    assert received_message["content"] == "Hello, World!"

@pytest.mark.asyncio
async def test_websocket_message_validation(connection_manager: ConnectionManager):
    """Test message validation"""
    user_id = uuid.uuid4()
    mock_ws = MockWebSocket()
    
    # Connect user
    await connection_manager.connect(mock_ws, user_id, "Test User")
    
    # Test message too long
    long_message = "x" * 1001  # Exceeds max_message_length
    message_data = {
        "type": "MSG",
        "chat_id": str(uuid.uuid4()),
        "content": long_message
    }
    
    response = await connection_manager.handle_message(mock_ws, message_data)
    assert response is not None
    assert response["error_code"] == "VALIDATION"

@pytest.mark.asyncio
async def test_websocket_ping_pong(connection_manager: ConnectionManager):
    """Test ping/pong functionality"""
    user_id = uuid.uuid4()
    mock_ws = MockWebSocket()
    
    # Connect user
    await connection_manager.connect(mock_ws, user_id, "Test User")
    
    # Test ping
    ping_data = {"type": "PING"}
    response = await connection_manager.handle_message(mock_ws, ping_data)
    assert response is None
    
    # Check that pong was sent
    assert len(mock_ws.sent_messages) > 0
    pong_message = mock_ws.sent_messages[-1]
    assert pong_message["type"] == "PONG"

@pytest.mark.asyncio
async def test_websocket_presence_broadcast(connection_manager: ConnectionManager):
    """Test presence broadcast functionality"""
    user1_id = uuid.uuid4()
    user2_id = uuid.uuid4()
    mock_ws1 = MockWebSocket()
    mock_ws2 = MockWebSocket()
    
    # Connect first user
    await connection_manager.connect(mock_ws1, user1_id, "User 1")
    
    # Connect second user (should trigger presence broadcast)
    await connection_manager.connect(mock_ws2, user2_id, "User 2")
    
    # Both users should receive presence updates
    assert len(mock_ws1.sent_messages) > 0
    assert len(mock_ws2.sent_messages) > 0
    
    # Check for presence messages
    presence_messages = [msg for msg in mock_ws1.sent_messages if msg["type"] == "PRESENCE"]
    assert len(presence_messages) > 0
