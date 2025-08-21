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
    logger.info("WebSocket endpoint called - before accept")
    user_id: Optional[UUID] = None
    display_name: str = ""
    
    try:
        # Accept the WebSocket connection first
        logger.info("About to accept WebSocket connection")
        await websocket.accept()
        logger.info("WebSocket connection accepted")
        logger.info("Starting WebSocket message processing...")
        
        # Wait for HELLO message
        hello_received = False
        while not hello_received:
            try:
                logger.info("Waiting for HELLO message...")
                data = await websocket.receive_text()
                logger.info(f"Received data: {data}")
                message_data = json.loads(data)
                
                if message_data.get("type") == MessageType.HELLO:
                    logger.info(f"Processing HELLO message: {message_data}")
                    hello_msg = HelloMessage(**message_data)
                    display_name = hello_msg.display_name
                    user_id = hello_msg.user_id or uuid4()
                    session_id = hello_msg.session_id
                    
                    logger.info(f"Connecting user {user_id} ({display_name}) to manager")
                    # Connect to manager (but don't broadcast presence yet)
                    await connection_manager.connect_without_broadcast(websocket, user_id, display_name, session_id)
                    hello_received = True
                    
                    logger.info(f"User {display_name} ({user_id}) sent HELLO")
                    
                    # Send acknowledgment first
                    await websocket.send_text(json.dumps({
                        "type": "HELLO_ACK",
                        "user_id": str(user_id),
                        "message": "Connected successfully"
                    }, default=str))
                    
                    # Now broadcast presence update to other users
                    await connection_manager.broadcast_presence_update("connect", user_id, display_name)
                else:
                    # Send error for non-HELLO message
                    try:
                        error_msg = ErrorMessage(
                            error_code="HELLO_REQUIRED",
                            message="HELLO message must be sent first"
                        )
                        await websocket.send_text(json.dumps(error_msg.model_dump(), default=str))
                    except WebSocketDisconnect:
                        logger.info("WebSocket disconnected during HELLO error")
                        return
                    except Exception as e:
                        logger.error(f"Failed to send HELLO error: {e}")
                        return
                    return  # Close connection after error
                    
            except json.JSONDecodeError:
                try:
                    error_msg = ErrorMessage(
                        error_code="INVALID_JSON",
                        message="Invalid JSON format"
                    )
                    await websocket.send_text(json.dumps(error_msg.model_dump(), default=str))
                except WebSocketDisconnect:
                    logger.info("WebSocket disconnected during JSON decode error")
                    return
                except Exception as e:
                    logger.error(f"Failed to send JSON decode error: {e}")
                    return
                return  # Close connection after error
        
        # Main message handling loop
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                
                # Handle ping/pong
                if message_data.get("type") == "PING":
                    await websocket.send_text(json.dumps({"type": "PONG"}, default=str))
                    continue
                
                if message_data.get("type") == "PONG":
                    # PONG response received, no action needed
                    continue
                
                # Process message through manager
                logger.info(f"Processing message through manager: {message_data}")
                response = await connection_manager.handle_message(websocket, message_data)
                
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
