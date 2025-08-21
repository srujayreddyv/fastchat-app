import json
import logging
from typing import Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from ..websocket_manager import connection_manager
from ..websocket_dtos import HelloMessage, ErrorMessage, MessageType
import asyncio
import os

logger = logging.getLogger(__name__)
router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time chat"""
    user_id: Optional[UUID] = None
    display_name: str = ""
    
    try:
        # Accept the WebSocket connection immediately
        await websocket.accept()
        
        # Wait for HELLO message with shorter timeout
        hello_received = False
        timeout_counter = 0
        max_timeout = 20  # Reduced from 50 to 20 (2 seconds timeout)
        
        while not hello_received and timeout_counter < max_timeout:
            try:
                # Use shorter timeout for faster response
                data = await asyncio.wait_for(websocket.receive_text(), timeout=0.05)
                message_data = json.loads(data)
                
                if message_data.get("type") == MessageType.HELLO:
                    hello_msg = HelloMessage(**message_data)
                    display_name = hello_msg.display_name
                    user_id = hello_msg.user_id or uuid4()
                    session_id = hello_msg.session_id
                    
                    # Connect to manager immediately
                    await connection_manager.connect_without_broadcast(websocket, user_id, display_name, session_id)
                    hello_received = True
                    
                    # Send acknowledgment immediately
                    await websocket.send_text(json.dumps({
                        "type": "HELLO_ACK",
                        "user_id": str(user_id),
                        "message": "Connected successfully"
                    }, default=str))
                    
                    # Broadcast presence update asynchronously (don't wait)
                    asyncio.create_task(connection_manager.broadcast_presence_update("connect", user_id, display_name))
                    break  # Exit the loop immediately after successful HELLO
                else:
                    # Send error for non-HELLO message
                    error_msg = ErrorMessage(
                        error_code="HELLO_REQUIRED",
                        message="HELLO message must be sent first"
                    )
                    await websocket.send_text(json.dumps(error_msg.model_dump(), default=str))
                    return  # Close connection after error
                    
            except asyncio.TimeoutError:
                timeout_counter += 1
                continue
            except json.JSONDecodeError:
                error_msg = ErrorMessage(
                    error_code="INVALID_JSON",
                    message="Invalid JSON format"
                )
                await websocket.send_text(json.dumps(error_msg.model_dump(), default=str))
                return  # Close connection after error
        
        if not hello_received:
            # Send timeout error
            error_msg = ErrorMessage(
                error_code="HELLO_TIMEOUT",
                message="HELLO message not received within timeout"
            )
            await websocket.send_text(json.dumps(error_msg.model_dump(), default=str))
            return
        
        # Main message handling loop
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Process message through manager
                # Only log in debug mode
                if os.getenv("DEBUG", "false").lower() == "true":
                    logger.info(f"Processing message through manager: {message_data}")
                response = await connection_manager.handle_message(websocket, user_id, message_data)
                
                if response:
                    try:
                        await websocket.send_text(json.dumps(response, default=str))
                    except WebSocketDisconnect:
                        logger.warning(f"WebSocket disconnected while sending response to user {display_name} ({user_id})")
                        break
                    
            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected for user {display_name} ({user_id})")
                break  # Exit the loop on disconnect
                
            except json.JSONDecodeError:
                try:
                    error_msg = ErrorMessage(
                        error_code="INVALID_JSON",
                        message="Invalid JSON format"
                    )
                    await websocket.send_text(json.dumps(error_msg.model_dump(), default=str))
                except WebSocketDisconnect:
                    logger.info(f"WebSocket disconnected during JSON error for user {display_name} ({user_id})")
                    break
                except Exception:
                    logger.error("Failed to send JSON error message to client")
                    break
                
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                try:
                    error_msg = ErrorMessage(
                        error_code="INTERNAL_ERROR",
                        message="Internal server error"
                    )
                    await websocket.send_text(json.dumps(error_msg.model_dump(), default=str))
                except WebSocketDisconnect:
                    logger.info(f"WebSocket disconnected during error handling for user {display_name} ({user_id})")
                    break
                except Exception:
                    logger.error("Failed to send error message to client")
                    break
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {display_name} ({user_id})")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
    finally:
        # Always clean up on exit
        if user_id:
            await connection_manager.disconnect(user_id)


@router.get("/ws/status")
async def websocket_status():
    """Get WebSocket connection status"""
    return connection_manager.get_status()


@router.post("/ws/cleanup")
async def cleanup_stale_connections():
    """Clean up stale WebSocket connections"""
    try:
        cleaned_count = await connection_manager.cleanup_stale_connections()
        return {
            "message": f"Cleaned up {cleaned_count} stale connections",
            "cleaned_connections": cleaned_count,
            "remaining_connections": len(connection_manager.active_connections)
        }
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup connections")
