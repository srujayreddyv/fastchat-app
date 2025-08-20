import { getUserIdentity, UserIdentity } from '../utils/identity';

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
  chat_id: string;
  timestamp?: string;
}

export interface TypingMessage {
  type: 'TYPING';
  chat_id: string;
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
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private isConnecting = false;
  private identity: UserIdentity;

  constructor() {
    this.identity = getUserIdentity();
  }

  // Connect to WebSocket
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.hostname}:8000/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.sendHello();
        this.startHeartbeat();
        this.emit('connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', {});
        
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, this.reconnectDelay * this.reconnectAttempts);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', error);
      };

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.isConnecting = false;
      this.emit('error', error);
    }
  }

  // Send HELLO message
  private sendHello(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const helloMessage: WebSocketMessage = {
        type: 'HELLO',
        display_name: this.identity.displayName,
        user_id: this.identity.id
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

    switch (type) {
      case 'HELLO_ACK':
        this.emit('hello_ack', payload);
        break;
      case 'PRESENCE':
        this.emit('presence', payload);
        break;
      case 'CHAT_OPENED':
        this.emit('chat_opened', payload);
        break;
      case 'MSG':
        this.emit('message', payload);
        break;
      case 'TYPING':
        this.emit('typing', payload);
        break;
      case 'ERROR':
        this.emit('error', payload);
        break;
      case 'PONG':
        this.emit('pong', payload);
        break;
      default:
        console.warn('Unknown message type:', type);
    }
  }

  // Send message
  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
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
  sendMessage(chatId: string, content: string): void {
    const message: ChatMessage = {
      type: 'MSG',
      chat_id: chatId,
      content
    };
    this.send(message);
  }

  // Send typing indicator
  sendTyping(chatId: string, isTyping: boolean): void {
    const message: TypingMessage = {
      type: 'TYPING',
      chat_id: chatId,
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
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
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
