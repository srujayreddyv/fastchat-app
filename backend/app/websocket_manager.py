import asyncio
import json
import logging
import time
from datetime import datetime
from typing import Dict, Set, Optional, List
from uuid import UUID, uuid4
from fastapi import WebSocket, WebSocketDisconnect
from .websocket_dtos import (
    MessageType, HelloMessage, OpenChatMessage, ChatMessage, 
    TypingMessage, ErrorMessage, PresenceMessage, ChatOpenedMessage,
    WebSocketMessage
)
from .rate_limiter import rate_limiter
from .metrics import metrics

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections and chat sessions"""
    
    def __init__(self):
        # Active connections: user_id -> WebSocket
        self.active_connections: Dict[UUID, WebSocket] = {}
        
        # Session to user mapping: session_id -> user_id
        self.session_users: Dict[str, UUID] = {}
        
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
        
        # Task management
        self._ping_task = None
        self._cleanup_task = None
        self._running = False
    
    async def connect(self, websocket: WebSocket, user_id: UUID, display_name: str):
        """Connect a new WebSocket client"""
        # Check if user already has a connection
        if user_id in self.active_connections:
            # Disconnect the old connection first
            old_websocket = self.active_connections[user_id]
            try:
                await old_websocket.close(code=1000, reason="New connection from same user")
            except Exception:
                pass  # Ignore errors from old connection
        
        await self.connect_without_broadcast(websocket, user_id, display_name)
        # Broadcast presence update to other users (not the newly connected user)
        await self.broadcast_presence_update("connect", user_id, display_name)
    
    async def connect_without_broadcast(self, websocket: WebSocket, user_id: UUID, display_name: str, session_id: str = None):
        """Connect a new WebSocket client without broadcasting presence"""
        # WebSocket is already accepted in the router
        self.active_connections[user_id] = websocket
        self.user_info[user_id] = display_name
        self.last_ping[user_id] = datetime.utcnow()
        
        # Store session mapping if provided
        if session_id:
            self.session_users[session_id] = user_id
        
        # Record metrics
        metrics.record_connection(user_id)
        
        logger.info(f"User {display_name} ({user_id}) connected with session {session_id}")
        
        # Restore user to their previous chat session if they were in one
        await self.restore_user_chat_session(user_id)
    
    async def disconnect(self, user_id: UUID):
        """Disconnect a WebSocket client"""
        if user_id in self.active_connections:
            display_name = self.user_info.get(user_id, "Unknown")
            del self.active_connections[user_id]
            await self._cleanup_disconnected_user(user_id)
            logger.info(f"User {display_name} ({user_id}) disconnected")
            
            # Broadcast presence update
            await self.broadcast_presence_update("disconnect", user_id, display_name)
            
            # Schedule cleanup of chat sessions after a delay to allow for reconnection
            asyncio.create_task(self.delayed_cleanup_user_chats(user_id))
    
    async def _cleanup_disconnected_user(self, user_id: UUID):
        """Internal method to clean up user data without broadcasting"""
        if user_id in self.user_info:
            del self.user_info[user_id]
        if user_id in self.last_ping:
            del self.last_ping[user_id]
        
        # Clean up session mappings
        session_ids_to_remove = [sid for sid, uid in self.session_users.items() if uid == user_id]
        for session_id in session_ids_to_remove:
            del self.session_users[session_id]
        
        # Don't clean up chat sessions immediately - keep them for reconnection
        # Only clean up typing indicators
        for chat_id in list(self.typing_users.keys()):
            if user_id in self.typing_users[chat_id]:
                self.typing_users[chat_id].remove(user_id)
                if not self.typing_users[chat_id]:
                    del self.typing_users[chat_id]
        
        # Reset rate limits
        rate_limiter.reset_user_limits(user_id)
        
        # Record metrics
        metrics.record_disconnection(user_id)
    
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
    
    async def restore_user_chat_session(self, user_id: UUID):
        """Restore user to their previous chat session after reconnection"""
        # Check if user was in a chat session that still exists
        for chat_id, participants in self.chat_sessions.items():
            if user_id in participants:
                # Restore the user's chat mapping
                self.user_chats[user_id] = chat_id
                logger.info(f"Restored user {user_id} to chat session {chat_id}")
                
                # Get the other participant in the chat
                other_participant = None
                for participant_id in participants:
                    if participant_id != user_id and participant_id in self.active_connections:
                        other_participant = participant_id
                        break
                
                if other_participant:
                    # Send CHAT_OPENED message to restored user to reactivate the UI
                    chat_opened_msg = ChatOpenedMessage(
                        chat_id=chat_id,
                        participants=[str(user_id), str(other_participant)],
                        target_user_id=other_participant,
                        target_display_name=self.user_info.get(other_participant, "Unknown User")
                    )
                    await self.send_personal_message(chat_opened_msg.model_dump(), user_id)
                    logger.info(f"Sent CHAT_OPENED message to restored user {user_id}")
                
                break
    
    async def delayed_cleanup_user_chats(self, user_id: UUID):
        """Clean up chat sessions after a delay to allow for reconnection"""
        # Wait 5 seconds before cleaning up chat sessions (reduced from 30)
        await asyncio.sleep(5)
        
        # Only clean up if user is still not connected
        if user_id not in self.active_connections:
            logger.info(f"Cleaning up chat sessions for user {user_id} after delay")
            await self.cleanup_user_chats(user_id)
    
    async def send_personal_message(self, message: dict, user_id: UUID):
        """Send message to specific user"""
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                # Convert UUIDs to strings for JSON serialization
                def convert_uuids(obj):
                    if isinstance(obj, UUID):
                        return str(obj)
                    elif isinstance(obj, dict):
                        return {k: convert_uuids(v) for k, v in obj.items()}
                    elif isinstance(obj, list):
                        return [convert_uuids(item) for item in obj]
                    return obj
                
                serializable_message = convert_uuids(message)
                logger.info(f"Sending message to user {user_id}: {serializable_message}")
                await websocket.send_text(json.dumps(serializable_message))
                logger.info(f"Message sent successfully to user {user_id}")
            except WebSocketDisconnect:
                logger.warning(f"WebSocket disconnected while sending message to user {user_id}")
                # Remove dead connection and cleanup
                if user_id in self.active_connections:
                    del self.active_connections[user_id]
                # Don't call disconnect here as it might cause recursion
                await self._cleanup_disconnected_user(user_id)
            except Exception as e:
                logger.error(f"Failed to send message to {user_id}: {type(e).__name__}: {str(e)}")
                # Remove failed connection
                if user_id in self.active_connections:
                    del self.active_connections[user_id]
        else:
            logger.warning(f"User {user_id} not found in active connections")
    
    async def broadcast_presence_update(self, action: str, user_id: UUID, display_name: str):
        """Broadcast presence update to all connected users"""
        logger.info(f"Broadcasting presence update: {action} for user {display_name} ({user_id})")
        
        if action == "connect":
            # For connect action, send different messages to different users
            
            # Get current online users for the newly connected user (excluding themselves)
            online_users_for_new_user = []
            for uid, name in self.user_info.items():
                if uid in self.active_connections and uid != user_id:
                    online_users_for_new_user.append({
                        "user_id": str(uid),
                        "display_name": name,
                        "online": True
                    })
            
            # Send list of existing users to the newly connected user
            presence_message_for_new_user = PresenceMessage(
                users=online_users_for_new_user,
                action=action
            )
            await self.send_personal_message(presence_message_for_new_user.model_dump(), user_id)
            logger.info(f"Sent {len(online_users_for_new_user)} existing users to new user {user_id}")
            
            # Notify other users about the new user
            if len(self.active_connections) > 1:
                new_user_message = PresenceMessage(
                    users=[{
                        "user_id": str(user_id),
                        "display_name": display_name,
                        "online": True
                    }],
                    action=action
                )
                
                # Send to all other connected users
                for uid in list(self.active_connections.keys()):
                    if uid != user_id:
                        await self.send_personal_message(new_user_message.model_dump(), uid)
                        logger.info(f"Notified user {uid} about new user {user_id}")
        
        elif action == "disconnect":
            # For disconnect, notify all remaining users
            disconnect_message = PresenceMessage(
                users=[{
                    "user_id": str(user_id),
                    "display_name": display_name,
                    "online": False
                }],
                action=action
            )
            
            # Send to all remaining connected users
            for uid in list(self.active_connections.keys()):
                if uid != user_id:
                    await self.send_personal_message(disconnect_message.model_dump(), uid)
                    logger.info(f"Notified user {uid} about user {user_id} disconnecting")
    
    async def handle_connection_failure(self, user_id: UUID):
        """Handle connection failures"""
        logger.warning(f"Connection failure for user {user_id}")
        await self.disconnect(user_id)
    
    async def create_or_get_chat(self, user1_id: UUID, user2_id: UUID) -> UUID:
        """Create or get existing chat between two users"""
        # Check if chat already exists
        for chat_id, participants in self.chat_sessions.items():
            if user1_id in participants and user2_id in participants:
                logger.info(f"Found existing chat {chat_id} between users {user1_id} and {user2_id}")
                # Ensure both users are mapped to this chat
                self.user_chats[user1_id] = chat_id
                self.user_chats[user2_id] = chat_id
                return chat_id
        
        # Create new chat
        chat_id = uuid4()
        self.chat_sessions[chat_id] = {user1_id, user2_id}
        self.user_chats[user1_id] = chat_id
        self.user_chats[user2_id] = chat_id
        
        logger.info(f"Created new chat {chat_id} between users {user1_id} and {user2_id}")
        return chat_id
    
    async def send_to_chat(self, chat_id: UUID, message: dict, exclude_user: Optional[UUID] = None):
        """Send message to all users in a chat"""
        if chat_id in self.chat_sessions:
            logger.info(f"Sending message to chat {chat_id}, participants: {self.chat_sessions[chat_id]}, exclude: {exclude_user}")
            for user_id in self.chat_sessions[chat_id]:
                if user_id != exclude_user:
                    logger.info(f"Sending message to user {user_id}")
                    await self.send_personal_message(message, user_id)
        else:
            logger.warning(f"Chat {chat_id} not found in chat sessions")
    
    async def handle_message(self, websocket: WebSocket, data: dict) -> Optional[dict]:
        """Handle incoming WebSocket message"""
        logger.info(f"Received WebSocket message: {data}")
        start_time = time.time()
        try:
            message_type = data.get("type")
            
            # Get user_id from websocket connection
            user_id = self.get_user_id_by_websocket(websocket)
            if not user_id:
                metrics.record_error("NOT_CONNECTED")
                return ErrorMessage(
                    error_code="NOT_CONNECTED",
                    message="Not connected to WebSocket"
                ).model_dump()
            
            # Check rate limits
            if not rate_limiter.check_rate_limit(user_id, message_type):
                metrics.record_rate_limit_hit(user_id)
                return ErrorMessage(
                    error_code="RATE_LIMITED",
                    message="Rate limit exceeded. Please slow down."
                ).model_dump()
            
            # Record message metrics
            processing_time = time.time() - start_time
            metrics.record_message(user_id, message_type, processing_time)
            
            if message_type == MessageType.HELLO:
                return await self.handle_hello(data)
            elif message_type == MessageType.OPEN_CHAT:
                return await self.handle_open_chat(data, user_id)
            elif message_type == MessageType.MSG:
                return await self.handle_chat_message(data, user_id)
            elif message_type == MessageType.TYPING:
                return await self.handle_typing(data, user_id)
            elif message_type == MessageType.PING:
                return await self.handle_ping(data, user_id)
            else:
                metrics.record_error("UNKNOWN_MESSAGE_TYPE", user_id)
                return ErrorMessage(
                    error_code="UNKNOWN_MESSAGE_TYPE",
                    message=f"Unknown message type: {message_type}"
                ).model_dump()
                
        except Exception as e:
            processing_time = time.time() - start_time
            metrics.record_error("INTERNAL_ERROR", user_id if 'user_id' in locals() else None)
            logger.error(f"Error handling message: {e}")
            return ErrorMessage(
                error_code="INTERNAL_ERROR",
                message="Internal server error"
            ).model_dump()
    
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
                ).model_dump()
            
            # Check if we're already in a chat with this user
            if user_id in self.user_chats:
                existing_chat_id = self.user_chats[user_id]
                if existing_chat_id in self.chat_sessions:
                    participants = self.chat_sessions[existing_chat_id]
                    if target_user_id in participants:
                        logger.info(f"User {user_id} already in chat {existing_chat_id} with {target_user_id}")
                        # Return existing chat info instead of creating new one
                        chat_opened_msg = ChatOpenedMessage(
                            chat_id=existing_chat_id,
                            participants=[str(user_id), str(target_user_id)],
                            target_user_id=target_user_id,
                            target_display_name=open_chat_msg.target_display_name
                        )
                        await self.send_personal_message(chat_opened_msg.model_dump(), user_id)
                        return None
            
            # Create or get chat
            chat_id = await self.create_or_get_chat(user_id, target_user_id)
            
            # Send CHAT_OPENED message to both users
            chat_opened_msg = ChatOpenedMessage(
                chat_id=chat_id,
                participants=[str(user_id), str(target_user_id)],
                target_user_id=target_user_id,
                target_display_name=open_chat_msg.target_display_name
            )
            
            await self.send_personal_message(chat_opened_msg.model_dump(), user_id)
            await self.send_personal_message(chat_opened_msg.model_dump(), target_user_id)
            
            return None
            
        except Exception as e:
            return ErrorMessage(
                error_code="INVALID_OPEN_CHAT",
                message=str(e)
            ).model_dump()
    
    async def handle_chat_message(self, data: dict, user_id: UUID) -> Optional[dict]:
        """Handle MSG message"""
        try:
            logger.info(f"Handling chat message from user {user_id}: {data}")
            
            # Get the user's current chat ID
            if user_id not in self.user_chats:
                logger.warning(f"User {user_id} not in any chat")
                return ErrorMessage(
                    error_code="NOT_IN_CHAT",
                    message="You are not currently in a chat"
                ).model_dump()
            
            chat_id = self.user_chats[user_id]
            logger.info(f"User {user_id} is in chat {chat_id}")
            
            # Validate user is in the chat
            if chat_id not in self.chat_sessions or user_id not in self.chat_sessions[chat_id]:
                logger.warning(f"User {user_id} not in chat session {chat_id}")
                return ErrorMessage(
                    error_code="NOT_IN_CHAT",
                    message="You are not a participant in this chat"
                ).model_dump()
            
            # Get message content from data
            content = data.get("content", "")
            if not content:
                logger.warning(f"Empty message content from user {user_id}")
                return ErrorMessage(
                    error_code="VALIDATION",
                    message="Message content cannot be empty"
                ).model_dump()
            
            # Validate message length
            if len(content) > self.max_message_length:
                logger.warning(f"Message too long from user {user_id}: {len(content)} chars")
                return ErrorMessage(
                    error_code="VALIDATION",
                    message=f"Message content cannot exceed {self.max_message_length} characters"
                ).model_dump()
            
            # Get sender's display name
            sender_name = self.user_info.get(user_id, "Unknown")
            
            # Create message payload for sending to other participants
            message_payload = {
                "type": "MSG",
                "content": content,
                "sender_id": str(user_id),
                "sender_name": sender_name,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Ensure message payload is complete before sending
            if "sender_id" not in message_payload or "sender_name" not in message_payload:
                logger.error(f"Message payload missing required fields: {message_payload}")
                return ErrorMessage(
                    error_code="INTERNAL_ERROR", 
                    message="Failed to create complete message payload"
                ).model_dump()
            
            # Send message to other participants
            await self.send_to_chat(chat_id, message_payload, exclude_user=user_id)
            
            logger.info(f"Message sent successfully from user {user_id}")
            return None
            
        except Exception as e:
            logger.error(f"Error handling chat message from user {user_id}: {e}")
            return ErrorMessage(
                error_code="INVALID_MESSAGE",
                message=str(e)
            ).model_dump()
    
    async def handle_typing(self, data: dict, user_id: UUID) -> Optional[dict]:
        """Handle TYPING message"""
        try:
            # Get the user's current chat ID
            if user_id not in self.user_chats:
                return ErrorMessage(
                    error_code="NOT_IN_CHAT",
                    message="You are not currently in a chat"
                ).model_dump()
            
            chat_id = self.user_chats[user_id]
            
            # Validate user is in the chat
            if chat_id not in self.chat_sessions or user_id not in self.chat_sessions[chat_id]:
                return ErrorMessage(
                    error_code="NOT_IN_CHAT",
                    message="You are not a participant in this chat"
                ).model_dump()
            
            is_typing = data.get("is_typing", False)
            
            # Create typing message with user info
            typing_msg = {
                "type": "TYPING",
                "user_id": str(user_id),
                "display_name": self.user_info.get(user_id, "Unknown"),
                "is_typing": is_typing
            }
            
            # Update typing indicators
            if chat_id not in self.typing_users:
                self.typing_users[chat_id] = set()
            
            if is_typing:
                self.typing_users[chat_id].add(user_id)
            else:
                self.typing_users[chat_id].discard(user_id)
                if not self.typing_users[chat_id]:
                    del self.typing_users[chat_id]
            
            # Send typing indicator to other participants
            await self.send_to_chat(chat_id, typing_msg, exclude_user=user_id)
            
            return None
            
        except Exception as e:
            return ErrorMessage(
                error_code="INVALID_TYPING",
                message=str(e)
            ).model_dump()
    
    async def handle_ping(self, data: dict, user_id: UUID) -> Optional[dict]:
        """Handle PING message"""
        try:
            # Update last ping time
            self.last_ping[user_id] = datetime.utcnow()
            
            # Send PONG response directly to the user
            pong_message = {"type": "PONG"}
            await self.send_personal_message(pong_message, user_id)
            
            # Return None since we sent the response directly
            return None
            
        except Exception as e:
            return ErrorMessage(
                error_code="INVALID_PING",
                message=str(e)
            ).model_dump()
    
    def get_user_id_by_websocket(self, websocket: WebSocket) -> Optional[UUID]:
        """Get user ID from WebSocket connection"""
        for user_id, ws in self.active_connections.items():
            if ws == websocket:
                return user_id
        return None
    
    async def cleanup_stale_connections(self):
        """Clean up stale connections that are no longer active"""
        stale_connections = []
        
        for user_id, websocket in list(self.active_connections.items()):
            try:
                # Try to send a ping to check if connection is alive
                await websocket.send_text('{"type":"PING"}')
            except Exception:
                # Connection is stale, mark for removal
                logger.warning(f"Found stale connection for user {user_id}")
                stale_connections.append(user_id)
        
        # Clean up stale connections
        for user_id in stale_connections:
            await self.disconnect(user_id)
        
        return len(stale_connections)
    
    def get_status(self) -> dict:
        """Get current connection manager status"""
        return {
            "active_connections": len(self.active_connections),
            "chat_sessions": len(self.chat_sessions),
            "user_chats": {str(k): str(v) for k, v in self.user_chats.items()},
            "chat_sessions_detail": {
                str(k): [str(uid) for uid in v] 
                for k, v in self.chat_sessions.items()
            },
            "online_users": [
                {"user_id": str(user_id), "display_name": name}
                for user_id, name in self.user_info.items()
                if user_id in self.active_connections
            ]
        }
    
    async def start_ping_task(self):
        """Start ping/pong monitoring task"""
        while self._running:
            try:
                await asyncio.sleep(self.ping_interval)
                if not self._running:
                    break
                    
                current_time = datetime.utcnow()
                
                for user_id in list(self.active_connections.keys()):
                    if user_id in self.last_ping:
                        time_diff = (current_time - self.last_ping[user_id]).total_seconds()
                        if time_diff > self.ping_interval * 2:
                            logger.warning(f"User {user_id} missed ping, disconnecting")
                            await self.disconnect(user_id)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in ping task: {e}")
                await asyncio.sleep(5)  # Wait before retrying

    async def start_background_tasks(self):
        """Start background tasks for connection management"""
        if not self._running:
            self._running = True
            self._ping_task = asyncio.create_task(self.start_ping_task())
            self._cleanup_task = asyncio.create_task(self.start_cleanup_task())
            logger.info("Background tasks started")
    
    async def stop_background_tasks(self):
        """Stop background tasks"""
        if self._running:
            self._running = False
            if self._ping_task:
                self._ping_task.cancel()
                try:
                    await self._ping_task
                except asyncio.CancelledError:
                    pass
            if self._cleanup_task:
                self._cleanup_task.cancel()
                try:
                    await self._cleanup_task
                except asyncio.CancelledError:
                    pass
            logger.info("Background tasks stopped")
    
    async def start_cleanup_task(self):
        """Start periodic cleanup task"""
        while self._running:
            try:
                await asyncio.sleep(60)  # Run every minute
                if self._running:
                    await self.cleanup_stale_connections()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup task: {e}")
                await asyncio.sleep(10)  # Wait before retrying


# Global connection manager instance
connection_manager = ConnectionManager()
