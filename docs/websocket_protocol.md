# FastChat WebSocket Protocol

## Overview

FastChat uses WebSocket connections for real-time communication between clients and the server. This document describes the message format, protocol flow, and all supported message types.

## Connection

- **URL**: `ws://localhost:8000/ws`
- **Protocol**: WebSocket (RFC 6455)
- **Message Format**: JSON
- **Encoding**: UTF-8

## Message Format

All messages follow this JSON structure:

```json
{
  "type": "MESSAGE_TYPE",
  "data": {
    // Message-specific payload
  }
}
```

## Message Types

### Client → Server Messages

#### HELLO

Sent by client when connecting to establish identity.

```json
{
  "type": "HELLO",
  "data": {
    "user_id": "uuid-string",
    "display_name": "User Display Name"
  }
}
```

#### OPEN_CHAT

Request to open a chat session with another user.

```json
{
  "type": "OPEN_CHAT",
  "data": {
    "target_user_id": "uuid-string",
    "target_display_name": "Target User Name"
  }
}
```

#### MSG

Send a chat message to another user.

```json
{
  "type": "MSG",
  "data": {
    "to": "target-user-id",
    "content": "Message content",
    "message_id": "optional-message-id"
  }
}
```

#### TYPING

Send typing indicator.

```json
{
  "type": "TYPING",
  "data": {
    "is_typing": true
  }
}
```

#### PING

Heartbeat ping to keep connection alive.

```json
{
  "type": "PING",
  "data": {}
}
```

### Server → Client Messages

#### HELLO_ACK

Acknowledgment of successful connection.

```json
{
  "type": "HELLO_ACK",
  "data": {
    "user_id": "uuid-string",
    "status": "connected"
  }
}
```

#### PRESENCE

Broadcast of online users list.

```json
{
  "type": "PRESENCE",
  "data": {
    "users": [
      {
        "user_id": "uuid-string",
        "display_name": "User Name",
        "online": true
      }
    ]
  }
}
```

#### CHAT_OPENED

Confirmation that a chat session has been opened.

```json
{
  "type": "CHAT_OPENED",
  "data": {
    "chat_id": "chat-session-id",
    "participants": ["user1-id", "user2-id"],
    "target_user_id": "target-user-id",
    "target_display_name": "Target User Name"
  }
}
```

#### MSG

Incoming chat message.

```json
{
  "type": "MSG",
  "data": {
    "from": "sender-user-id",
    "to": "recipient-user-id",
    "content": "Message content",
    "message_id": "message-id",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### MSG_ACK

Message acknowledgment.

```json
{
  "type": "MSG_ACK",
  "data": {
    "message_id": "message-id",
    "status": "delivered"
  }
}
```

#### TYPING

Typing indicator from another user.

```json
{
  "type": "TYPING",
  "data": {
    "user_id": "user-id",
    "is_typing": true
  }
}
```

#### PONG

Response to ping.

```json
{
  "type": "PONG",
  "data": {
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

#### ERROR

Error message from server.

```json
{
  "type": "ERROR",
  "data": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  }
}
```

## Error Codes

| Code              | Description                  |
| ----------------- | ---------------------------- |
| `VALIDATION`      | Message validation failed    |
| `MESSAGE_FAILED`  | Message delivery failed      |
| `USER_NOT_FOUND`  | Target user not found        |
| `CHAT_NOT_OPENED` | Chat session not established |
| `RATE_LIMITED`    | Too many messages            |
| `UNAUTHORIZED`    | Authentication required      |

## Connection Flow

### 1. Connection Establishment

```
Client                    Server
  |                         |
  |--- HELLO -------------->|
  |                         |
  |<-- HELLO_ACK ----------|
  |                         |
  |<-- PRESENCE -----------|
```

### 2. Chat Session Opening

```
Client A                   Server                   Client B
  |                         |                         |
  |--- OPEN_CHAT ---------->|                         |
  |                         |                         |
  |<-- CHAT_OPENED --------|                         |
  |                         |                         |
  |                         |--- CHAT_OPENED -------->|
```

### 3. Message Exchange

```
Client A                   Server                   Client B
  |                         |                         |
  |--- MSG ---------------->|                         |
  |                         |                         |
  |<-- MSG_ACK ------------|                         |
  |                         |                         |
  |                         |--- MSG ---------------->|
  |                         |                         |
  |                         |<-- MSG_ACK ------------|
```

### 4. Typing Indicators

```
Client A                   Server                   Client B
  |                         |                         |
  |--- TYPING ------------->|                         |
  |                         |                         |
  |                         |--- TYPING ------------->|
  |                         |                         |
  |                         |<-- TYPING -------------|
```

## Heartbeat Mechanism

- **Ping Interval**: 15 seconds
- **Pong Timeout**: 5 seconds
- **Reconnection**: Automatic with exponential backoff

```
Client                    Server
  |                         |
  |--- PING --------------->|
  |                         |
  |<-- PONG ---------------|
  |                         |
  |--- PING --------------->|
  |                         |
  |<-- PONG ---------------|
```

## Message Validation

### Content Limits

- **Maximum Message Length**: 1000 characters
- **Minimum Message Length**: 1 character
- **User ID Format**: UUID v4
- **Display Name**: 3-50 characters

### Rate Limiting

- **Messages per minute**: 60
- **Typing indicators**: 10 per minute
- **Heartbeat**: 15-second intervals

## Security Considerations

### Input Sanitization

- All user input is sanitized
- HTML/script tags are stripped
- SQL injection protection via ORM

### Authentication

- User identity is established via HELLO message
- No persistent authentication (stateless)
- UUID-based user identification

### CORS

- WebSocket connections respect CORS policy
- Origin validation on connection
- Configurable allowed origins

## Implementation Notes

### Client Implementation

```javascript
// Example WebSocket client usage
const ws = new WebSocket("ws://localhost:8000/ws");

ws.onopen = () => {
  // Send HELLO message
  ws.send(
    JSON.stringify({
      type: "HELLO",
      data: {
        user_id: "user-uuid",
        display_name: "User Name",
      },
    })
  );
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};
```

### Server Implementation

```python
# Example WebSocket handler
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            await handle_message(websocket, message)
    except WebSocketDisconnect:
        handle_disconnect(websocket)
```

## Testing

### Manual Testing

Use the provided test script:

```bash
python scripts/manual_test.py
```

### WebSocket Testing Tools

- Browser Developer Tools (Network tab)
- WebSocket King (Chrome extension)
- wscat (command-line tool)

### Example Test Messages

```bash
# Connect and send HELLO
echo '{"type":"HELLO","data":{"user_id":"test-123","display_name":"Test User"}}' | wscat -c ws://localhost:8000/ws

# Send a message
echo '{"type":"MSG","data":{"to":"user-456","content":"Hello!"}}' | wscat -c ws://localhost:8000/ws
```
