import json
import logging
from typing import Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from ..websocket_manager import connection_manager
from ..websocket_dtos import HelloMessage, ErrorMessage, MessageType

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time chat"""
    user_id: Optional[UUID] = None
    display_name: str = ""
    
    try:
        await websocket.accept()
        logger.info("WebSocket connection accepted")
        
        # Wait for HELLO message
        hello_received = False
        while not hello_received:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                if message_data.get("type") == MessageType.HELLO:
                    hello_msg = HelloMessage(**message_data)
                    display_name = hello_msg.display_name
                    user_id = hello_msg.user_id or uuid4()
                    
                    # Connect to manager
                    await connection_manager.connect(websocket, user_id, display_name)
                    hello_received = True
                    
                    logger.info(f"User {display_name} ({user_id}) sent HELLO")
                    
                    # Send acknowledgment
                    await websocket.send_text(json.dumps({
                        "type": "HELLO_ACK",
                        "user_id": str(user_id),
                        "message": "Connected successfully"
                    }))
                else:
                    # Send error for non-HELLO message
                    error_msg = ErrorMessage(
                        error_code="HELLO_REQUIRED",
                        message="HELLO message must be sent first"
                    )
                    await websocket.send_text(json.dumps(error_msg.dict()))
                    
            except json.JSONDecodeError:
                error_msg = ErrorMessage(
                    error_code="INVALID_JSON",
                    message="Invalid JSON format"
                )
                await websocket.send_text(json.dumps(error_msg.dict()))
        
        # Main message handling loop
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Handle ping/pong
                if message_data.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}))
                    continue
                
                # Process message through manager
                response = await connection_manager.handle_message(websocket, message_data)
                
                if response:
                    await websocket.send_text(json.dumps(response))
                    
            except json.JSONDecodeError:
                error_msg = ErrorMessage(
                    error_code="INVALID_JSON",
                    message="Invalid JSON format"
                )
                await websocket.send_text(json.dumps(error_msg.dict()))
                
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                error_msg = ErrorMessage(
                    error_code="INTERNAL_ERROR",
                    message="Internal server error"
                )
                await websocket.send_text(json.dumps(error_msg.dict()))
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {display_name} ({user_id})")
        if user_id:
            await connection_manager.disconnect(user_id)
            
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if user_id:
            await connection_manager.disconnect(user_id)
        raise HTTPException(status_code=500, detail="WebSocket error")


@router.get("/ws/status")
async def websocket_status():
    """Get WebSocket connection status"""
    return {
        "active_connections": len(connection_manager.active_connections),
        "chat_sessions": len(connection_manager.chat_sessions),
        "online_users": [
            {
                "user_id": str(uid),
                "display_name": name
            }
            for uid, name in connection_manager.user_info.items()
            if uid in connection_manager.active_connections
        ]
    }
