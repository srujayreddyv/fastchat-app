import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Grid, 
  Typography, 
  ThemeProvider, 
  createTheme, 
  CssBaseline,
  Snackbar,
  Alert
} from '@mui/material';
import { usePresenceStore } from './stores/presence';
import { useChatStore } from './stores/chat';
import { websocketClient } from './services/websocket';
import { heartbeatService } from './services/heartbeat';
import { getUserIdentity } from './utils/identity';
import ChatPane from './components/ChatPane';
import OnlineUsers from './components/OnlineUsers';
import ConnectionBanner from './components/ConnectionBanner';

// Define proper interfaces
interface OnlineUser {
  user_id: string;
  display_name: string;
  online: boolean;
}

interface PresenceData {
  users: OnlineUser[];
  action: 'connect' | 'disconnect' | 'update';
}

interface ChatOpenedData {
  chat_id: string;
  target_user_id: string;
  target_display_name: string;
}

interface WebSocketError {
  message?: string;
  error_code?: string;
}

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showError, setShowError] = useState(false);
  
  const {
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    updateConnectionStatus,
    setCurrentUser
  } = usePresenceStore();

  const {
    selectedUser,
    getMessagesForUser,
    isUserTyping,
    isChatActive,
    loadChatState
  } = useChatStore();

  // Load initial online users immediately via REST API
  const loadInitialUsers = async () => {
    try {
      const users = await heartbeatService.getOnlineUsers();
      
      // Convert to the format expected by the presence store
      const formattedUsers = users.map(user => ({
        user_id: user.user_id || user.id, // Use user_id if available, fallback to id
        display_name: user.display_name,
        online: true
      }));
      
      // Only set users if we're not connected via WebSocket yet
      // This prevents REST API from overriding WebSocket presence updates
      const connectionStatus = websocketClient.getConnectionStatus();
      if (connectionStatus !== 'connected') {
        setOnlineUsers(formattedUsers);
      }
    } catch (error) {
      // Only log errors in development
      if ((import.meta as any).env?.DEV) {
        console.error('Failed to load initial users:', error);
      }
    }
  };

  useEffect(() => {
    // Set current user identity
    const identity = getUserIdentity();
    setCurrentUser({
      user_id: identity.id,
      display_name: identity.displayName,
      online: true
    });
    
    // Initial connection status check
    setTimeout(() => {
      const connectionStatus = websocketClient.getConnectionStatus();
      if (connectionStatus !== usePresenceStore.getState().connectionStatus) {
        updateConnectionStatus(connectionStatus);
      }
    }, 500);

    // Load saved chat state
    loadChatState();
    
    // Load initial online users
    loadInitialUsers();

    // Send initial heartbeat to mark user as online
    heartbeatService.sendHeartbeat();

    // Connect immediately without delay to avoid connection issues
    if (websocketClient.getConnectionStatus() === 'disconnected') {
      websocketClient.connect();
    }

    // Check connection status after a shorter delay
    setTimeout(() => {
      const currentStatus = websocketClient.getConnectionStatus();
      
      // Update status if it doesn't match
      if (currentStatus !== usePresenceStore.getState().connectionStatus) {
        updateConnectionStatus(currentStatus);
      }
    }, 500); // Reduced from 1000ms to 500ms

    // Start heartbeat service immediately
    if (!heartbeatService.isActive()) {
      heartbeatService.start();
    }

    // Handle page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Page became visible, check connection status
        if (websocketClient.getConnectionStatus() === 'disconnected') {
          websocketClient.reconnect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle connection status changes
    const handleConnected = () => {
      updateConnectionStatus('connected');
      const identity = getUserIdentity();
      setCurrentUser({
        user_id: identity.id,
        display_name: identity.displayName,
        online: true
      });
    };

    const handleDisconnected = () => {
      updateConnectionStatus('disconnected');
      
      // Fallback to REST API if WebSocket is still disconnected after delay
      setTimeout(() => {
        if (websocketClient.getConnectionStatus() === 'disconnected') {
          loadInitialUsers();
        }
      }, 2000);
    };

    const handleConnecting = () => {
      updateConnectionStatus('connecting');
    };

    // Handle network status changes
    const handleNetworkOffline = () => {
      console.log('Network went offline');
      // Don't update connection status to 'disconnected' when network is offline
      // This prevents UI confusion - let the WebSocket handle reconnection
    };

    const handlePresence = (data: PresenceData) => {
      const identity = getUserIdentity();
      if (data.users && Array.isArray(data.users)) {
        if (data.action === 'connect') {
          // For connect actions, add each user individually (excluding current user)
          data.users.forEach((user: OnlineUser) => {
            if (user.online && user.user_id !== identity.id) {
              addOnlineUser(user);
            } else if (!user.online) {
              removeOnlineUser(user.user_id);
            }
          });
        } else if (data.action === 'disconnect') {
          // For disconnect actions, remove users
          data.users.forEach((user: OnlineUser) => {
            removeOnlineUser(user.user_id);
          });
        } else {
          // Default behavior - replace the entire list (excluding current user)
          const filteredUsers = data.users.filter((user: OnlineUser) => user.user_id !== identity.id);
          setOnlineUsers(filteredUsers);
        }
      }
    };

    const handleError = (error: WebSocketError) => {
      // Only log WebSocket errors in development
      if ((import.meta as any).env?.DEV) {
        console.error('WebSocket error:', error);
      }
      
      // Don't show error for rate limiting or connection issues
      if (error.message && !error.message.includes('Rate limit') && !error.message.includes('Connection')) {
        setErrorMessage(error.message || 'An error occurred');
        setShowError(true);
      }
      
      // Attempt manual reconnect on error
      setTimeout(() => {
        if (websocketClient.getConnectionStatus() === 'disconnected') {
          websocketClient.reconnect();
        }
      }, 2000);
    };

    // Chat event handlers
    const handleMessage = () => {
      // The WebSocket service already handles adding messages to the store
      // This is just for additional logging or UI updates if needed
    };

    const handleTyping = () => {
      // Typing indicators are handled by the WebSocket service
    };

    const handleChatOpened = (data: ChatOpenedData) => {
      // The chat is now established, we can start sending messages
      // The backend has already set up the chat session
      
      if (data.chat_id && data.target_user_id) {
        // Set the selected user to the target user of the chat
        // This allows switching between different chat sessions
        useChatStore.getState().setSelectedUser({
          user_id: data.target_user_id,
          display_name: data.target_display_name || 'Unknown User',
          online: true
        });
        
        // Ensure chat is active for this user
        useChatStore.getState().setChatActive(data.target_user_id, data.chat_id);
        
        // Load any existing messages for this user
        const chatStore = useChatStore.getState();
        const existingMessages = chatStore.getMessagesForUser(data.target_user_id);
        if (existingMessages.length > 0) {
          // Messages already exist, ensure they're displayed
          console.log(`Loaded ${existingMessages.length} existing messages for user ${data.target_user_id}`);
        }
      }
    };

    // Register event handlers
    websocketClient.on('connected', handleConnected);
    websocketClient.on('disconnected', handleDisconnected);
    websocketClient.on('connecting', handleConnecting);
    websocketClient.on('presence', handlePresence);
    websocketClient.on('message', handleMessage);
    websocketClient.on('typing', handleTyping);
    websocketClient.on('chat_opened', handleChatOpened);
    websocketClient.on('error', handleError);
    websocketClient.on('network_offline', handleNetworkOffline);
    
    // Start heartbeat service
    heartbeatService.start();

    // Cleanup on unmount
    return () => {
      // Remove visibility change listener
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Remove event handlers
      websocketClient.off('connected', handleConnected);
      websocketClient.off('disconnected', handleDisconnected);
      websocketClient.off('connecting', handleConnecting);
      websocketClient.off('presence', handlePresence);
      websocketClient.off('message', handleMessage);
      websocketClient.off('typing', handleTyping);
      websocketClient.off('chat_opened', handleChatOpened);
      websocketClient.off('error', handleError);
      websocketClient.off('network_offline', handleNetworkOffline);

      // Only disconnect if this is the last component using the connection
      // In React StrictMode, this prevents immediate reconnection
      setTimeout(() => {
        if (websocketClient.getConnectionStatus() !== 'disconnected') {
          websocketClient.disconnect();
        }
        if (heartbeatService.isActive()) {
          heartbeatService.stop();
        }
      }, 200);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
          <ConnectionBanner />
          
          <Container maxWidth={false} sx={{ py: 4, pt: 8, px: { xs: 2, sm: 3, md: 4 } }}>
            <Box textAlign="center" mb={4}>
              <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
                FastChat 🚀
              </Typography>
              <Typography variant="h6" color="text.secondary">
                Real-time chat with live presence updates
              </Typography>
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4} md={3}>
                <OnlineUsers />
              </Grid>

              <Grid item xs={12} sm={8} md={9}>
                <ChatPane
                  selectedUser={selectedUser}
                  onSendMessage={(message) => {
                    if (selectedUser) {
                      const currentUserId = getUserIdentity().id;
                      
                      // Add the message to the chat store immediately (optimistic update)
                      const chatStore = useChatStore.getState();
                      chatStore.addMessage({
                        from: currentUserId,
                        to: selectedUser.user_id,
                        content: message,
                        status: 'sending',
                        timestamp: new Date().toISOString() // Use ISO string for consistency
                      } as any);
                      
                      // Send the message via WebSocket
                      websocketClient.sendMessage(message);
                    }
                  }}
                  messages={selectedUser ? getMessagesForUser(selectedUser.user_id) : []}
                  isTyping={selectedUser ? isUserTyping(selectedUser.user_id) : false}
                  onTyping={(isTyping) => {
                    websocketClient.sendTyping(isTyping);
                  }}
                  connectionStatus={usePresenceStore.getState().connectionStatus}
                  isChatActive={selectedUser ? isChatActive(selectedUser.user_id) : false}
                />
              </Grid>
            </Grid>
          </Container>
        </Box>
      </ThemeProvider>

      {/* Error Snackbar */}
      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={() => setShowError(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowError(false)}
          severity="error"
          sx={{ width: '100%' }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
}

export default App;
