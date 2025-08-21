from enum import Enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator
from uuid import UUID


class MessageType(str, Enum):
    """WebSocket message types"""
    HELLO = "HELLO"
    OPEN_CHAT = "OPEN_CHAT"
    MSG = "MSG"
    TYPING = "TYPING"
    PING = "PING"
    PONG = "PONG"
    ERROR = "ERROR"
    PRESENCE = "PRESENCE"
    CHAT_OPENED = "CHAT_OPENED"


class BaseWebSocketMessage(BaseModel):
    """Base WebSocket message"""
    type: MessageType


class HelloMessage(BaseWebSocketMessage):
    """Initial connection message"""
    type: MessageType = MessageType.HELLO
    display_name: str = Field(..., min_length=1, max_length=100)
    user_id: Optional[UUID] = None
    session_id: Optional[str] = None  # Add session ID for unique tab identification


class OpenChatMessage(BaseWebSocketMessage):
    """Request to open a chat with another user"""
    type: MessageType = MessageType.OPEN_CHAT
    target_user_id: UUID
    target_display_name: str = Field(..., min_length=1, max_length=100)


class ChatMessage(BaseWebSocketMessage):
    """Chat message between users"""
    type: MessageType = MessageType.MSG
    content: str = Field(..., min_length=1, max_length=1000)
    chat_id: UUID
    timestamp: Optional[str] = None

    @field_validator('content')
    @classmethod
    def validate_content_length(cls, v):
        if len(v) > 1000:
            raise ValueError('Message content cannot exceed 1000 characters')
        return v


class TypingMessage(BaseWebSocketMessage):
    """Typing indicator"""
    type: MessageType = MessageType.TYPING
    chat_id: UUID
    is_typing: bool


class ErrorMessage(BaseWebSocketMessage):
    """Error message"""
    type: MessageType = MessageType.ERROR
    error_code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class PresenceMessage(BaseWebSocketMessage):
    """Presence update"""
    type: MessageType = MessageType.PRESENCE
    users: list
    action: str  # "connect", "disconnect", "update"


class ChatOpenedMessage(BaseWebSocketMessage):
    """Chat opened confirmation"""
    type: MessageType = MessageType.CHAT_OPENED
    chat_id: UUID
    participants: list
    target_user_id: UUID
    target_display_name: str


# Union type for all WebSocket messages
WebSocketMessage = HelloMessage | OpenChatMessage | ChatMessage | TypingMessage | ErrorMessage | PresenceMessage | ChatOpenedMessage
