import asyncio
import json
import logging
from datetime import datetime
from typing import Dict, Set, Optional, List
from uuid import UUID, uuid4
from fastapi import WebSocket, WebSocketDisconnect
from .websocket_dtos import (
    MessageType, HelloMessage, OpenChatMessage, ChatMessage, 
    TypingMessage, ErrorMessage, PresenceMessage, ChatOpenedMessage,
    WebSocketMessage
)

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and chat sessions"""
    
    def __init__(self):
        # Active connections: user_id -> WebSocket
        self.active_connections: Dict[UUID, WebSocket] = {}
        
        # User info: user_id -> display_name
        self.user_info: Dict[UUID, str] = {}
        
        # Chat sessions: chat_id -> set of user_ids
        self.chat_sessions: Dict[UUID, Set[UUID]] = {}
        
        # User to chat mapping: user_id -> chat_id
        self.user_chats: Dict[UUID, UUID] = {}
        
        # Typing indicators: chat_id -> set of typing user_ids
        self.typing_users: Dict[UUID, Set[UUID]] = {}
        
        # Ping/pong tracking
        self.last_ping: Dict[UUID, datetime] = {}
        
        # Configuration
        self.max_message_length = 1000
        self.ping_interval = 15  # seconds
    
    async def connect(self, websocket: WebSocket, user_id: UUID, display_name: str):
        """Connect a new WebSocket client"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_info[user_id] = display_name
        self.last_ping[user_id] = datetime.utcnow()
        
        logger.info(f"User {display_name} ({user_id}) connected")
        
        # Broadcast presence update
        await self.broadcast_presence_update("connect", user_id, display_name)
    
    async def disconnect(self, user_id: UUID):
        """Disconnect a WebSocket client"""
        if user_id in self.active_connections:
            display_name = self.user_info.get(user_id, "Unknown")
            del self.active_connections[user_id]
            del self.user_info[user_id]
            if user_id in self.last_ping:
                del self.last_ping[user_id]
            
            # Clean up chat sessions
            await self.cleanup_user_chats(user_id)
            
            logger.info(f"User {display_name} ({user_id}) disconnected")
            
            # Broadcast presence update
            await self.broadcast_presence_update("disconnect", user_id, display_name)
    
    async def cleanup_user_chats(self, user_id: UUID):
        """Clean up chat sessions when user disconnects"""
        # Remove from typing indicators
        for chat_id in list(self.typing_users.keys()):
            if user_id in self.typing_users[chat_id]:
                self.typing_users[chat_id].remove(user_id)
                if not self.typing_users[chat_id]:
                    del self.typing_users[chat_id]
        
        # Remove from chat sessions
        if user_id in self.user_chats:
            chat_id = self.user_chats[user_id]
            if chat_id in self.chat_sessions:
                self.chat_sessions[chat_id].discard(user_id)
                if len(self.chat_sessions[chat_id]) < 2:
                    del self.chat_sessions[chat_id]
            del self.user_chats[user_id]
    
    async def send_personal_message(self, message: dict, user_id: UUID):
        """Send message to specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send message to {user_id}: {e}")
                await self.handle_connection_failure(user_id)
    
    async def broadcast_presence_update(self, action: str, user_id: UUID, display_name: str):
        """Broadcast presence update to all connected users"""
        # Get current online users from presence service
        online_users = []
        for uid, name in self.user_info.items():
            if uid in self.active_connections:
                online_users.append({
                    "user_id": str(uid),
                    "display_name": name,
                    "online": True
                })
        
        presence_message = PresenceMessage(
            users=online_users,
            action=action
        )
        
        # Broadcast to all connected users
        for uid in list(self.active_connections.keys()):
            await self.send_personal_message(presence_message.dict(), uid)
    
    async def handle_connection_failure(self, user_id: UUID):
        """Handle connection failures"""
        logger.warning(f"Connection failure for user {user_id}")
        await self.disconnect(user_id)
    
    async def create_or_get_chat(self, user1_id: UUID, user2_id: UUID) -> UUID:
        """Create or get existing chat between two users"""
        # Check if chat already exists
        for chat_id, participants in self.chat_sessions.items():
            if user1_id in participants and user2_id in participants:
                return chat_id
        
        # Create new chat
        chat_id = uuid4()
        self.chat_sessions[chat_id] = {user1_id, user2_id}
        self.user_chats[user1_id] = chat_id
        self.user_chats[user2_id] = chat_id
        
        return chat_id
    
    async def send_to_chat(self, chat_id: UUID, message: dict, exclude_user: Optional[UUID] = None):
        """Send message to all users in a chat"""
        if chat_id in self.chat_sessions:
            for user_id in self.chat_sessions[chat_id]:
                if user_id != exclude_user:
                    await self.send_personal_message(message, user_id)
    
    async def handle_message(self, websocket: WebSocket, data: dict) -> Optional[dict]:
        """Handle incoming WebSocket message"""
        try:
            message_type = data.get("type")
            
            # Get user_id from websocket connection
            user_id = self.get_user_id_by_websocket(websocket)
            if not user_id:
                return ErrorMessage(
                    error_code="NOT_CONNECTED",
                    message="Not connected to WebSocket"
                ).dict()
            
            if message_type == MessageType.HELLO:
                return await self.handle_hello(data)
            elif message_type == MessageType.OPEN_CHAT:
                return await self.handle_open_chat(data, user_id)
            elif message_type == MessageType.MSG:
                return await self.handle_chat_message(data, user_id)
            elif message_type == MessageType.TYPING:
                return await self.handle_typing(data, user_id)
            else:
                return ErrorMessage(
                    error_code="UNKNOWN_MESSAGE_TYPE",
                    message=f"Unknown message type: {message_type}"
                ).dict()
                
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            return ErrorMessage(
                error_code="INTERNAL_ERROR",
                message="Internal server error"
            ).dict()
    
    async def handle_hello(self, data: dict) -> Optional[dict]:
        """Handle HELLO message"""
        # This is handled during connection setup
        return None
    
    async def handle_open_chat(self, data: dict, user_id: UUID) -> Optional[dict]:
        """Handle OPEN_CHAT message"""
        try:
            open_chat_msg = OpenChatMessage(**data)
            target_user_id = open_chat_msg.target_user_id
            
            # Validate target user exists and is online
            if target_user_id not in self.active_connections:
                return ErrorMessage(
                    error_code="USER_NOT_FOUND",
                    message="Target user is not online"
                ).dict()
            
            # Create or get chat
            chat_id = await self.create_or_get_chat(user_id, target_user_id)
            
            # Send CHAT_OPENED message to both users
            chat_opened_msg = ChatOpenedMessage(
                chat_id=chat_id,
                participants=[str(user_id), str(target_user_id)],
                target_user_id=target_user_id,
                target_display_name=open_chat_msg.target_display_name
            )
            
            await self.send_personal_message(chat_opened_msg.dict(), user_id)
            await self.send_personal_message(chat_opened_msg.dict(), target_user_id)
            
            return None
            
        except Exception as e:
            return ErrorMessage(
                error_code="INVALID_OPEN_CHAT",
                message=str(e)
            ).dict()
    
    async def handle_chat_message(self, data: dict, user_id: UUID) -> Optional[dict]:
        """Handle MSG message"""
        try:
            chat_msg = ChatMessage(**data)
            
            # Validate message length
            if len(chat_msg.content) > self.max_message_length:
                return ErrorMessage(
                    error_code="VALIDATION",
                    message=f"Message content cannot exceed {self.max_message_length} characters"
                ).dict()
            
            # Validate user is in the chat
            if chat_msg.chat_id not in self.chat_sessions or user_id not in self.chat_sessions[chat_msg.chat_id]:
                return ErrorMessage(
                    error_code="NOT_IN_CHAT",
                    message="You are not a participant in this chat"
                ).dict()
            
            # Add timestamp if not provided
            if not chat_msg.timestamp:
                chat_msg.timestamp = datetime.utcnow().isoformat()
            
            # Send message to other participants
            await self.send_to_chat(chat_msg.chat_id, chat_msg.dict(), exclude_user=user_id)
            
            return None
            
        except Exception as e:
            return ErrorMessage(
                error_code="INVALID_MESSAGE",
                message=str(e)
            ).dict()
    
    async def handle_typing(self, data: dict, user_id: UUID) -> Optional[dict]:
        """Handle TYPING message"""
        try:
            typing_msg = TypingMessage(**data)
            
            # Validate user is in the chat
            if typing_msg.chat_id not in self.chat_sessions or user_id not in self.chat_sessions[typing_msg.chat_id]:
                return ErrorMessage(
                    error_code="NOT_IN_CHAT",
                    message="You are not a participant in this chat"
                ).dict()
            
            # Update typing indicators
            if typing_msg.chat_id not in self.typing_users:
                self.typing_users[typing_msg.chat_id] = set()
            
            if typing_msg.is_typing:
                self.typing_users[typing_msg.chat_id].add(user_id)
            else:
                self.typing_users[typing_msg.chat_id].discard(user_id)
                if not self.typing_users[typing_msg.chat_id]:
                    del self.typing_users[typing_msg.chat_id]
            
            # Send typing indicator to other participants
            await self.send_to_chat(typing_msg.chat_id, typing_msg.dict(), exclude_user=user_id)
            
            return None
            
        except Exception as e:
            return ErrorMessage(
                error_code="INVALID_TYPING",
                message=str(e)
            ).dict()
    
    def get_user_id_by_websocket(self, websocket: WebSocket) -> Optional[UUID]:
        """Get user ID from WebSocket connection"""
        for user_id, ws in self.active_connections.items():
            if ws == websocket:
                return user_id
        return None
    
    async def start_ping_task(self):
        """Start ping/pong monitoring task"""
        while True:
            await asyncio.sleep(self.ping_interval)
            current_time = datetime.utcnow()
            
            for user_id in list(self.active_connections.keys()):
                if user_id in self.last_ping:
                    time_diff = (current_time - self.last_ping[user_id]).total_seconds()
                    if time_diff > self.ping_interval * 2:
                        logger.warning(f"User {user_id} missed ping, disconnecting")
                        self.disconnect(user_id)


# Global connection manager instance
connection_manager = ConnectionManager()
