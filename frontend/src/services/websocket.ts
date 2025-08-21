import { getUserIdentity, UserIdentity } from '../utils/identity';
import { useChatStore } from '../stores/chat';

export interface WebSocketMessage {
  type: string;
  [key: string]: unknown;
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

export interface TypingMessage extends WebSocketMessage {
  type: 'TYPING';
  is_typing: boolean;
}

export interface ChatSession {
  chat_id: string;
  participants: string[];
  target_user_id: string;
  target_display_name: string;
}

export interface WebSocketEventData {
  type?: string;
  [key: string]: unknown;
}

export type WebSocketEventHandler = (data: WebSocketEventData) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = Infinity; // Unlimited reconnection attempts
  private reconnectDelay = 1000;
  private heartbeatInterval: number | null = null;
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private isConnecting = false;
  private identity: UserIdentity;
  private messageQueue: WebSocketMessage[] = [];
  private isConnectionReady = false;
  private connectionAttemptTime: number = 0;
  private connectionTimeout: number | null = null;
  private failedMessages: Map<string, { message: WebSocketMessage; retries: number; timestamp: number }> = new Map();
  private maxRetries = 3;
  private retryDelay = 2000;
  private connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected' = 'disconnected';
  private lastPongTime: number = 0;
  private pongLatency: number[] = [];
  private connectionStartTime: number = 0;
  private connectionTimes: number[] = [];
  private statusPollingInterval: number | null = null;
  
  // Persistent connection features
  private persistentMode = true; // Always try to stay connected
  private connectionHealthCheck: number | null = null;
  private lastActivityTime = Date.now();
  private networkStatusListener: (() => void) | null = null;
  private visibilityChangeListener: (() => void) | null = null;
  private pageFocusListener: (() => void) | null = null;
  
  // Connection stability monitoring
  private connectionDrops: number = 0;
  private lastConnectionDrop: number = 0;
  private connectionStabilityMonitor: number | null = null;

  constructor() {
    this.identity = getUserIdentity();
    // Initialize persistent connection features lazily to avoid issues during page load
    setTimeout(() => {
      this.initializePersistentConnection();
    }, 100);
  }

  private initializePersistentConnection(): void {
    // Monitor network status changes
    this.setupNetworkMonitoring();
    
    // Monitor page visibility changes
    this.setupVisibilityMonitoring();
    
    // Monitor page focus changes
    this.setupFocusMonitoring();
    
    // Start connection health checks
    this.startConnectionHealthCheck();
    
    // Start connection stability monitoring
    this.startConnectionStabilityMonitoring();
  }

  private setupNetworkMonitoring(): void {
    if ('navigator' in window && 'onLine' in navigator) {
      this.networkStatusListener = () => {
        if (navigator.onLine) {
          // Network came back online - try to reconnect
          if ((import.meta as any).env?.DEV) {
            console.log('Network is back online - attempting to reconnect');
          }
          this.reconnect();
        } else {
          // Network went offline
          if ((import.meta as any).env?.DEV) {
            console.log('Network went offline');
          }
          this.emit('network_offline', {});
        }
      };
      
      window.addEventListener('online', this.networkStatusListener);
      window.addEventListener('offline', this.networkStatusListener);
    }
  }

  private setupVisibilityMonitoring(): void {
    this.visibilityChangeListener = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible - check connection and reconnect if needed
        if ((import.meta as any).env?.DEV) {
          console.log('Page became visible - checking connection');
        }
        this.checkConnectionAndReconnect();
      } else {
        // Page became hidden - reduce activity but keep connection alive
        if ((import.meta as any).env?.DEV) {
          console.log('Page became hidden - reducing activity');
        }
      }
    };
    
    document.addEventListener('visibilitychange', this.visibilityChangeListener);
  }

  private setupFocusMonitoring(): void {
    this.pageFocusListener = () => {
      // Page gained focus - check connection and reconnect if needed
      if ((import.meta as any).env?.DEV) {
        console.log('Page gained focus - checking connection');
      }
      this.checkConnectionAndReconnect();
    };
    
    window.addEventListener('focus', this.pageFocusListener);
  }

  private startConnectionHealthCheck(): void {
    // Check connection health every 60 seconds instead of 30
    this.connectionHealthCheck = window.setInterval(() => {
      this.checkConnectionHealth();
    }, 60000);
  }

  private startConnectionStabilityMonitoring(): void {
    // Monitor connection stability every 2 minutes
    this.connectionStabilityMonitor = window.setInterval(() => {
      this.checkConnectionStability();
    }, 120000);
  }

  private checkConnectionStability(): void {
    const now = Date.now();
    const timeSinceLastDrop = now - this.lastConnectionDrop;
    
    // If we've had more than 3 drops in the last 10 minutes, log a warning
    if (this.connectionDrops > 3 && timeSinceLastDrop < 600000) {
      if ((import.meta as any).env?.DEV) {
        console.warn(`Connection stability issue: ${this.connectionDrops} drops in the last 10 minutes`);
      }
    }
    
    // Reset drop counter if it's been more than 10 minutes since last drop
    if (timeSinceLastDrop > 600000) {
      this.connectionDrops = 0;
    }
  }

  private checkConnectionHealth(): void {
    const status = this.getConnectionStatus();
    const now = Date.now();
    
    // If disconnected and in persistent mode, try to reconnect
    if (status === 'disconnected' && this.persistentMode) {
      if ((import.meta as any).env?.DEV) {
        console.log('Connection health check: disconnected, attempting to reconnect');
      }
      this.reconnect();
    }
    
    // Check if connection is stale (no activity for 5 minutes instead of 2)
    if (status === 'connected' && (now - this.lastActivityTime) > 300000) {
      if ((import.meta as any).env?.DEV) {
        console.log('Connection health check: stale connection detected, sending ping');
      }
      this.send({ type: 'PING' });
    }
  }

  private checkConnectionAndReconnect(): void {
    const status = this.getConnectionStatus();
    if (status === 'disconnected' && this.persistentMode) {
      if ((import.meta as any).env?.DEV) {
        console.log('Checking connection: disconnected, attempting to reconnect');
      }
      this.reconnect();
    }
  }

  // Connect to WebSocket
  async connect(): Promise<void> {
    // Prevent rapid reconnection attempts (reduced from 200ms to 100ms)
    const now = Date.now();
    if (now - this.connectionAttemptTime < 100) {
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    // Reset connection state
    this.connectionAttemptTime = now;
    this.connectionStartTime = now;
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

      // Reduced connection timeout from 5s to 3s
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
      }, 3000); // Reduced from 5 seconds to 3 seconds

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
    
    // Track connection time
    const connectionTime = Date.now() - this.connectionStartTime;
    this.connectionTimes.push(connectionTime);
    if (this.connectionTimes.length > 10) {
      this.connectionTimes.shift();
    }
    
    // Log connection performance
    if ((import.meta as any).env?.DEV) {
      console.log(`WebSocket connected in ${connectionTime}ms`);
      const avgConnectionTime = this.connectionTimes.reduce((a, b) => a + b, 0) / this.connectionTimes.length;
      console.log(`Average connection time: ${avgConnectionTime.toFixed(0)}ms`);
      
      // Warn if connection is taking too long
      if (connectionTime > 2000) {
        console.warn(`Slow connection detected: ${connectionTime}ms`);
      }
    }
    
    this.isConnecting = false;
    this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    
    // Send HELLO immediately without delay
    this.sendHello();
    this.startHeartbeat();
    this.startRetryMechanism(); // Start retry mechanism on successful connection
    this.startStatusPolling(); // Start status polling
    
    // Don't emit connected here - wait for HELLO_ACK
    // this.emit('connected', {});
  }

  private handleConnectionClose(event: CloseEvent): void {
    this.isConnecting = false;
    this.isConnectionReady = false;
    this.stopHeartbeat();
    this.stopStatusPolling(); // Stop status polling
    this.emit('disconnected', {});
    
    // Track connection drops for stability monitoring
    this.connectionDrops++;
    this.lastConnectionDrop = Date.now();
    
    if ((import.meta as any).env?.DEV) {
      console.log(`Connection dropped (code: ${event.code}). Total drops: ${this.connectionDrops}`);
    }
    
    // Always attempt to reconnect in persistent mode unless it was a manual disconnect
    if (event.code !== 1000 && this.persistentMode) {
      // Use exponential backoff with longer initial delay and max delay
      const delay = Math.min(this.reconnectDelay * Math.pow(1.2, this.reconnectAttempts), 15000); // Max 15 seconds, gentler backoff
      
      if ((import.meta as any).env?.DEV) {
        console.log(`Connection closed (code: ${event.code}), attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
      }
      
      setTimeout(() => {
        this.reconnectAttempts++;
        this.emit('connecting', {});
        this.connect();
      }, delay);
    } else if (event.code === 1000) {
      // Manual disconnect - reset reconnect attempts
      this.reconnectAttempts = 0;
      if ((import.meta as any).env?.DEV) {
        console.log('Manual disconnect - not attempting to reconnect');
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
      
      try {
        this.ws.send(JSON.stringify(helloMessage));
      } catch (error) {
        if ((import.meta as any).env?.DEV) {
          console.error('Failed to send HELLO message:', error);
        }
      }
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
  private handleMessage(data: WebSocketEventData): void {
    // Update last activity time
    this.lastActivityTime = Date.now();
    
    const messageType = data.type;
    
    switch (messageType) {
      case 'HELLO_ACK':
        this.isConnectionReady = true;
        this.processMessageQueue();
        this.emit('hello_ack', data);
        // Emit connected event after HELLO_ACK to ensure proper status
        this.emit('connected', data);
        break;
      case 'PRESENCE':
        this.emit('presence', data);
        break;
      case 'CHAT_OPENED':
        this.emit('chat_opened', data);
        break;
      case 'MSG':
        this.handleChatMessage(data);
        // Send acknowledgment for received message
        this.sendMessageAck(data.message_id as string);
        break;
      case 'MSG_ACK':
        this.handleMessageAck(data);
        break;
      case 'TYPING':
        this.handleTypingIndicator(data);
        break;
      case 'ERROR':
        this.handleError(data);
        break;
      case 'PING':
        // Respond to PING with PONG for heartbeat
        this.send({ type: 'PONG' });
        break;
      case 'PONG':
        this.handlePong(data);
        break;
      default:
        // Silently ignore unknown message types instead of warning
        // This prevents console spam from unexpected message types
        break;
    }
  }

  // Handle chat messages
  private handleChatMessage(payload: WebSocketEventData): void {
    // The backend now sends messages with sender_id and sender_name
    const senderId = payload.sender_id as string;
    const content = payload.content as string;
    const messageId = payload.message_id as string;
    const timestamp = payload.timestamp as string;
    
    if (senderId && content) {
      // Add received message to store
      useChatStore.getState().addMessage({
        from: senderId,
        to: this.identity.id, // Current user is the recipient
        content: content,
        status: 'sent',
        message_id: messageId,
        timestamp: timestamp
      } as any);
      
      // Don't automatically switch the selected user
      // Let users manually choose when to switch between conversations
      // This prevents disrupting ongoing conversations
      const currentSelectedUser = useChatStore.getState().selectedUser;
      
      // Only switch if no user is currently selected (first message)
      if (!currentSelectedUser) {
        useChatStore.getState().setSelectedUser({
          user_id: senderId,
          display_name: payload.sender_name as string || 'Unknown User',
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
  private handleTypingIndicator(payload: WebSocketEventData): void {
    // const chatStore = useChatStore.getState();
    // The backend now sends typing indicators with user_id
    const userId = payload.user_id as string;
    if (userId) {
      useChatStore.getState().setTyping(userId, payload.is_typing as boolean);
    }
    this.emit('typing', payload);
  }

  // Handle errors
  private handleError(payload: WebSocketEventData): void {
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
      this.emit('error', new Error(`Validation error: ${payload.message as string}`));
    } else if (payload.type === 'MESSAGE_FAILED') {
      // Update message status to error
      const chatStore = useChatStore.getState();
      if (payload.message_id) {
        chatStore.updateMessageStatus(payload.message_id as string, 'error');
      }
      this.emit('error', new Error(`Message failed: ${payload.message as string}`));
    } else {
      this.emit('error', new Error(payload.message as string || 'Unknown error'));
    }
  }

  // Send message acknowledgment
  private sendMessageAck(messageId: string): void {
    const ackMessage = {
      type: 'MSG_ACK',
      message_id: messageId,
      status: 'received',
      timestamp: new Date().toISOString()
    };
    this.send(ackMessage);
  }

  // Handle message acknowledgments
  private handleMessageAck(data: WebSocketEventData): void {
    const messageId = data.message_id as string;
    const status = data.status as string;
    
    if (messageId) {
      // Update message status in chat store
      useChatStore.getState().updateMessageStatus(messageId, status === 'delivered' ? 'sent' : 'pending');
    }
    
    this.emit('message_ack', data);
  }

  // Retry failed messages
  private retryFailedMessages(): void {
    const now = Date.now();
    for (const [messageId, failedMessage] of this.failedMessages.entries()) {
      if (now - failedMessage.timestamp > this.retryDelay && failedMessage.retries < this.maxRetries) {
        // Retry the message
        failedMessage.retries++;
        failedMessage.timestamp = now;
        
        if (this.ws?.readyState === WebSocket.OPEN && this.isConnectionReady) {
          try {
            this.ws.send(JSON.stringify(failedMessage.message));
          } catch (error) {
            if ((import.meta as any).env?.DEV) {
              console.error('Failed to retry message:', error);
            }
          }
        }
      } else if (failedMessage.retries >= this.maxRetries) {
        // Mark message as permanently failed
        const chatStore = useChatStore.getState();
        chatStore.updateMessageStatus(messageId, 'error');
        this.failedMessages.delete(messageId);
      }
    }
  }

  // Start retry mechanism
  private startRetryMechanism(): void {
    setInterval(() => {
      this.retryFailedMessages();
    }, 5000); // Check every 5 seconds
  }

  // Start status polling
  private startStatusPolling(): void {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
    }
    
    this.statusPollingInterval = setInterval(() => {
      const currentStatus = this.getConnectionStatus();
      const actualStatus = this.getActualConnectionStatus();
      
      // If there's a mismatch, emit the correct status
      if (currentStatus !== actualStatus) {
        if ((import.meta as any).env?.DEV) {
          console.log(`Status mismatch detected: ${currentStatus} vs ${actualStatus}`);
        }
        this.emit(actualStatus, {});
      }
    }, 5000); // Increased from 2 seconds to 5 seconds to reduce overhead
  }

  // Stop status polling
  private stopStatusPolling(): void {
    if (this.statusPollingInterval) {
      clearInterval(this.statusPollingInterval);
      this.statusPollingInterval = null;
    }
  }

  // Get actual connection status based on WebSocket state
  private getActualConnectionStatus(): 'connecting' | 'connected' | 'disconnected' {
    if (this.isConnecting) return 'connecting';
    if (this.ws?.readyState === WebSocket.OPEN && this.isConnectionReady) return 'connected';
    return 'disconnected';
  }

  // Monitor connection quality
  private updateConnectionQuality(): void {
    if (this.pongLatency.length === 0) {
      this.connectionQuality = 'disconnected';
      return;
    }

    const avgLatency = this.pongLatency.reduce((a, b) => a + b, 0) / this.pongLatency.length;
    
    if (avgLatency < 100) {
      this.connectionQuality = 'excellent';
    } else if (avgLatency < 300) {
      this.connectionQuality = 'good';
    } else {
      this.connectionQuality = 'poor';
    }
  }

  // Get connection quality
  getConnectionQuality(): 'excellent' | 'good' | 'poor' | 'disconnected' {
    return this.connectionQuality;
  }

  // Handle pong with latency tracking
  private handlePong(payload: WebSocketEventData): void {
    const now = Date.now();
    this.lastPongTime = now;
    
    // Calculate latency if we have a ping time
    if (this.connectionStartTime > 0) {
      const latency = now - this.connectionStartTime;
      this.pongLatency.push(latency);
      
      // Keep only last 10 latency measurements
      if (this.pongLatency.length > 10) {
        this.pongLatency.shift();
      }
      
      this.updateConnectionQuality();
      
      if ((import.meta as any).env?.DEV) {
        console.log(`PONG received, latency: ${latency}ms, avg: ${this.getAverageLatency()}ms`);
      }
    }
    
    this.emit('pong', payload);
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

  private emit(event: string, data: WebSocketEventData | Event | Error | unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data as WebSocketEventData));
    }
  }

  // Disconnect
  disconnect(): void {
    this.stopHeartbeat();
    this.stopStatusPolling(); // Stop status polling
    this.stopConnectionHealthCheck(); // Stop health checks
    this.stopConnectionStabilityMonitoring(); // Stop stability monitoring
    this.cleanupEventListeners(); // Clean up event listeners
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    this.isConnectionReady = false;
    this.isConnecting = false; // Reset connecting state
    this.messageQueue = []; // Clear queued messages
    this.persistentMode = false; // Disable persistent mode for manual disconnect
    
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close(1000, 'Manual disconnect'); // Use proper close code
      this.ws = null;
    }
  }

  private stopConnectionHealthCheck(): void {
    if (this.connectionHealthCheck) {
      clearInterval(this.connectionHealthCheck);
      this.connectionHealthCheck = null;
    }
  }

  private stopConnectionStabilityMonitoring(): void {
    if (this.connectionStabilityMonitor) {
      clearInterval(this.connectionStabilityMonitor);
      this.connectionStabilityMonitor = null;
    }
  }

  private cleanupEventListeners(): void {
    // Remove network status listeners
    if (this.networkStatusListener) {
      window.removeEventListener('online', this.networkStatusListener);
      window.removeEventListener('offline', this.networkStatusListener);
      this.networkStatusListener = null;
    }
    
    // Remove visibility change listener
    if (this.visibilityChangeListener) {
      document.removeEventListener('visibilitychange', this.visibilityChangeListener);
      this.visibilityChangeListener = null;
    }
    
    // Remove page focus listener
    if (this.pageFocusListener) {
      window.removeEventListener('focus', this.pageFocusListener);
      this.pageFocusListener = null;
    }
  }

  // Manual reconnect
  reconnect(): void {
    this.disconnect();
    this.reconnectAttempts = 0; // Reset reconnect attempts for manual reconnect
    this.messageQueue = []; // Clear any stale messages
    this.persistentMode = true; // Re-enable persistent mode
    this.initializePersistentConnection(); // Re-initialize persistent features
    this.connect();
  }

  // Get connection status
  getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' {
    if (this.isConnecting) return 'connecting';
    if (this.ws?.readyState === WebSocket.OPEN && this.isConnectionReady) return 'connected';
    return 'disconnected';
  }

  // Get average latency
  private getAverageLatency(): number {
    if (this.pongLatency.length === 0) return 0;
    const sum = this.pongLatency.reduce((acc, latency) => acc + latency, 0);
    return Math.round(sum / this.pongLatency.length);
  }

  // Get detailed connection info
  getConnectionInfo() {
    return {
      status: this.getConnectionStatus(),
      quality: this.getConnectionQuality(),
      readyState: this.ws?.readyState,
      isConnectionReady: this.isConnectionReady,
      activeConnections: this.ws?.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export singleton instance
export const websocketClient = new WebSocketClient();
