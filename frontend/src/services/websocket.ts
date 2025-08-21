import { getUserIdentity, UserIdentity } from '../utils/identity';
import { useChatStore } from '../stores/chat';

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface OnlineUser {
  user_id: string;
  display_name: string;
  online: boolean;
}

export interface ChatMessage {
  type: 'MSG';
  content: string;
  to: string;
  message_id?: string;
  timestamp?: string;
}

export interface TypingMessage {
  type: 'TYPING';
  is_typing: boolean;
}

export interface ChatSession {
  chat_id: string;
  participants: string[];
  target_user_id: string;
  target_display_name: string;
}

export type WebSocketEventHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: number | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private isConnecting = false;
  private identity: UserIdentity;
  private messageQueue: WebSocketMessage[] = [];
  private isConnectionReady = false;
  private connectionAttemptTime: number = 0;
  private connectionTimeout: number | null = null;

  constructor() {
    this.identity = getUserIdentity();
  }

  // Connect to WebSocket
  async connect(): Promise<void> {
    // Prevent rapid reconnection attempts (within 500ms instead of 1000ms)
    const now = Date.now();
    if (now - this.connectionAttemptTime < 500) {
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    // Reset connection state
    this.connectionAttemptTime = now;
    this.isConnecting = true;
    this.isConnectionReady = false;

    try {
      const wsUrl = `ws://${window.location.hostname}:8000/ws`;
      
      // Check if we're in a browser environment
      if (typeof WebSocket === 'undefined') {
        throw new Error('WebSocket not supported in this environment');
      }
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          // Only log parsing errors in development
          if ((import.meta as any).env?.DEV) {
            console.error('Failed to parse WebSocket message:', error);
          }
        }
      };

      this.ws.onclose = (event) => {
        this.handleConnectionClose(event);
      };

      this.ws.onerror = (error) => {
        // Only log WebSocket errors in development
        if ((import.meta as any).env?.DEV) {
          console.error('WebSocket error:', error);
        }
        this.isConnecting = false;
        this.emit('error', error);
      };

      // Add connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          // Only log timeout errors in development
          if ((import.meta as any).env?.DEV) {
            console.error('WebSocket connection timeout');
          }
          this.ws.close();
          this.isConnecting = false;
          this.emit('error', new Error('WebSocket connection timeout'));
        }
      }, 10000); // 10 second timeout

      this.ws.onopen = () => {
        this.handleConnectionOpen();
      };

    } catch (error) {
      // Only log connection errors in development
      if ((import.meta as any).env?.DEV) {
        console.error('Failed to connect to WebSocket:', error);
      }
      this.isConnecting = false;
      this.emit('error', error);
    }
  }

  private handleConnectionOpen(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    
    // Reduced delay to ensure connection is fully established
    setTimeout(() => {
      this.sendHello();
      this.startHeartbeat();
    }, 50); // Reduced from 100ms to 50ms
    
    this.emit('connected', {});
  }

  private handleConnectionClose(event: CloseEvent): void {
    this.isConnecting = false;
    this.isConnectionReady = false;
    this.stopHeartbeat();
    this.emit('disconnected', {});
    
    // Always attempt to reconnect unless it was a manual disconnect
    if (event.code !== 1000) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
        setTimeout(() => {
          this.reconnectAttempts++;
          this.emit('connecting', {});
          this.connect();
        }, delay);
      } else {
        this.emit('error', new Error('Failed to reconnect to WebSocket'));
      }
    }
  }

  // Send HELLO message
  private sendHello(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Refresh identity to ensure we have the latest
      this.identity = getUserIdentity();
      
      const helloMessage: WebSocketMessage = {
        type: 'HELLO',
        display_name: this.identity.displayName,
        user_id: this.identity.id,
        session_id: this.identity.sessionId // Include session ID for unique tab identification
      };
      
      this.ws.send(JSON.stringify(helloMessage));
    }
  }

  // Start heartbeat loop
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Send ping
        this.ws.send(JSON.stringify({ type: 'PING' }));
      }
    }, 15000); // 15 seconds
  }

  // Stop heartbeat
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Handle incoming messages
  private handleMessage(data: any): void {
    const { type, ...payload } = data;
    // const chatStore = useChatStore.getState();

    switch (type) {
      case 'HELLO_ACK':
        this.isConnectionReady = true;
        this.processMessageQueue();
        this.emit('hello_ack', payload);
        break;
      case 'PRESENCE':
        this.emit('presence', payload);
        break;
      case 'CHAT_OPENED':
        this.emit('chat_opened', payload);
        break;
      case 'MSG':
        this.handleChatMessage(payload);
        break;
      case 'TYPING':
        this.handleTypingIndicator(payload);
        break;
      case 'ERROR':
        this.handleError(payload);
        break;
      case 'PING':
        // Respond to PING with PONG for heartbeat
        this.send({ type: 'PONG' });
        break;
      case 'PONG':
        this.emit('pong', payload);
        break;
      default:
        // Silently ignore unknown message types instead of warning
        // This prevents console spam from unexpected message types
        break;
    }
  }

  // Handle chat messages
  private handleChatMessage(payload: any): void {
    // The backend now sends messages with sender_id and sender_name
    const senderId = payload.sender_id;
    const content = payload.content;
    
    if (senderId && content) {
      // Add received message to store
      useChatStore.getState().addMessage({
        from: senderId,
        to: this.identity.id, // Current user
        content: content,
        status: 'sent'
      });
      
      // Don't automatically switch the selected user - let user manually select
      // This prevents interrupting the user's current conversation
      const currentSelectedUser = useChatStore.getState().selectedUser;
      
      // Only set selected user if no one is currently selected
      if (!currentSelectedUser) {
        useChatStore.getState().setSelectedUser({
          user_id: senderId,
          display_name: payload.sender_name || 'Unknown User',
          online: true
        });
      }
    } else {
      // Only warn about invalid payloads in development
      if ((import.meta as any).env?.DEV) {
        console.warn('Invalid message payload:', payload);
      }
    }

    this.emit('message', payload);
  }

  // Handle typing indicators
  private handleTypingIndicator(payload: any): void {
    // const chatStore = useChatStore.getState();
    // The backend now sends typing indicators with user_id
    const userId = payload.user_id;
    if (userId) {
      useChatStore.getState().setTyping(userId, payload.is_typing);
    }
    this.emit('typing', payload);
  }

  // Handle errors
  private handleError(payload: any): void {
    // Don't emit rate limit errors as they're expected and handled gracefully
    if (payload.error_code === 'RATE_LIMITED') {
      if ((import.meta as any).env?.DEV) {
        console.warn('Rate limit hit - this is normal behavior');
      }
      return;
    }
    
    // Don't emit NOT_CONNECTED errors during initial connection
    if (payload.error_code === 'NOT_CONNECTED' && !this.isConnectionReady) {
      if ((import.meta as any).env?.DEV) {
        console.warn('Connection not ready yet - this is normal during startup');
      }
      return;
    }
    
    // Only log other WebSocket errors in development
    if ((import.meta as any).env?.DEV) {
      console.error('WebSocket error received:', payload);
    }
    
    if (payload.type === 'VALIDATION') {
      this.emit('error', new Error(`Validation error: ${payload.message}`));
    } else if (payload.type === 'MESSAGE_FAILED') {
      // Update message status to error
      const chatStore = useChatStore.getState();
      if (payload.message_id) {
        chatStore.updateMessageStatus(payload.message_id, 'error');
      }
      this.emit('error', new Error(`Message failed: ${payload.message}`));
    } else {
      this.emit('error', new Error(payload.message || 'Unknown error'));
    }
  }

  // Send message
  send(message: WebSocketMessage): void {
    // Don't send HELLO messages through the queue - they need to be sent immediately
    if (message.type === 'HELLO') {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          const messageStr = JSON.stringify(message);
          this.ws.send(messageStr);
        } catch (error) {
          if ((import.meta as any).env?.DEV) {
            console.error('Failed to send HELLO message:', error);
          }
        }
      }
      return;
    }
    
    // For all other messages, check if connection is ready
    if (this.ws?.readyState === WebSocket.OPEN && this.isConnectionReady) {
      try {
        const messageStr = JSON.stringify(message);
        this.ws.send(messageStr);
      } catch (error) {
        // Only log send errors in development
        if ((import.meta as any).env?.DEV) {
          console.error('Failed to send message:', error);
        }
        this.queueMessage(message);
      }
    } else {
      // Only warn about queueing in development
      if ((import.meta as any).env?.DEV) {
        console.warn('WebSocket not ready, queueing message');
      }
      this.queueMessage(message);
    }
  }

  // Queue message for later sending
  private queueMessage(message: WebSocketMessage): void {
    this.messageQueue.push(message);
  }

  // Process queued messages
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN && this.isConnectionReady) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          this.ws.send(JSON.stringify(message));
        } catch (error) {
          // Only log queued message errors in development
          if ((import.meta as any).env?.DEV) {
            console.error('Failed to send queued message:', error);
          }
          // Put the message back at the front of the queue
          this.messageQueue.unshift(message);
          break;
        }
      }
    }
  }

  // Open chat with another user
  openChat(targetUserId: string, targetDisplayName: string): void {
    const message: WebSocketMessage = {
      type: 'OPEN_CHAT',
      target_user_id: targetUserId,
      target_display_name: targetDisplayName
    };
    this.send(message);
  }

  // Send chat message
  sendMessage(content: string): void {
    const message = {
      type: 'MSG',
      content
    };
    this.send(message);
  }

  // Send typing indicator
  sendTyping(isTyping: boolean): void {
    const message: TypingMessage = {
      type: 'TYPING',
      is_typing: isTyping
    };
    this.send(message);
  }

  // Event handling
  on(event: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // Disconnect
  disconnect(): void {
    this.stopHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    this.isConnectionReady = false;
    this.isConnecting = false; // Reset connecting state
    this.messageQueue = []; // Clear queued messages
    
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close(1000, 'Manual disconnect'); // Use proper close code
      this.ws = null;
    }
  }

  // Manual reconnect
  reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0; // Reset reconnect attempts for manual reconnect
    this.messageQueue = []; // Clear any stale messages
    this.connect();
  }

  // Get connection status
  getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' {
    if (this.isConnecting) return 'connecting';
    if (this.ws?.readyState === WebSocket.OPEN) return 'connected';
    return 'disconnected';
  }
}

// Export singleton instance
export const websocketClient = new WebSocketClient();
