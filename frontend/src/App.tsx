import { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Snackbar,
  Alert
} from '@mui/material';
import ConnectionBanner from './components/ConnectionBanner';
import OnlineUsers from './components/OnlineUsers';
import ChatPane from './components/ChatPane';
import { websocketClient } from './services/websocket';
import { heartbeatService } from './services/heartbeat';
import { usePresenceStore } from './stores/presence';
import { useChatStore } from './stores/chat';
import { getUserIdentity } from './utils/identity';

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
    setChatActive,
    isChatActive,
    loadChatState,
    restoreActiveChat
  } = useChatStore();

  useEffect(() => {
    const identity = getUserIdentity();
    
    // Set current user
    setCurrentUser({
      user_id: identity.id,
      display_name: identity.displayName,
      online: true
    });

    // Load saved chat state
    loadChatState();

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
        
        setOnlineUsers(formattedUsers);
      } catch (error) {
        // Only log errors in development
        if ((import.meta as any).env?.DEV) {
          console.error('Failed to load initial users:', error);
        }
      }
    };

    // Load users immediately
    loadInitialUsers();

    // Send initial heartbeat to mark user as online
    heartbeatService.sendHeartbeat();

    // Connect immediately without delay to avoid connection issues
    if (websocketClient.getConnectionStatus() === 'disconnected') {
      websocketClient.connect();
    }

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

    // WebSocket event handlers
    const handleConnected = async () => {
      updateConnectionStatus('connected');
      
      // Restore active chat after reconnection
      await restoreActiveChat();
    };

    const handleDisconnected = () => {
      updateConnectionStatus('disconnected');
    };

    const handleConnecting = () => {
      updateConnectionStatus('connecting');
    };

    const handlePresence = (data: any) => {
      if (data.users && Array.isArray(data.users)) {
        if (data.action === 'connect') {
          // For connect actions, add each user individually (excluding current user)
          data.users.forEach((user: any) => {
            if (user.online && user.user_id !== identity.id) {
              addOnlineUser(user);
            } else if (!user.online) {
              removeOnlineUser(user.user_id);
            }
          });
        } else if (data.action === 'disconnect') {
          // For disconnect actions, remove users
          data.users.forEach((user: any) => {
            removeOnlineUser(user.user_id);
          });
        } else {
          // Default behavior - replace the entire list (excluding current user)
          const filteredUsers = data.users.filter((user: any) => user.user_id !== identity.id);
          setOnlineUsers(filteredUsers);
        }
      }
    };

    const handleError = (error: any) => {
      // Only log WebSocket errors in development
      if ((import.meta as any).env?.DEV) {
        console.error('WebSocket error:', error);
      }
      setErrorMessage(error.message || 'An error occurred');
      setShowError(true);
      
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

    const handleChatOpened = (data: any) => {
      // The chat is now established, we can start sending messages
      // The backend has already set up the chat session
      
      if (data.chat_id && data.target_user_id) {
        // Only set the selected user if we don't already have one selected
        // This prevents disrupting existing chats
        const currentSelectedUser = useChatStore.getState().selectedUser;
        if (!currentSelectedUser) {
          useChatStore.getState().setSelectedUser({
            user_id: data.target_user_id,
            display_name: data.target_display_name || 'Unknown User',
            online: true
          });
        }
        
        // Ensure chat is active for this user
        useChatStore.getState().setChatActive(data.target_user_id, data.chat_id);
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
  }, [setOnlineUsers, addOnlineUser, removeOnlineUser, updateConnectionStatus, setCurrentUser, setChatActive, isChatActive]);

  return (
    <>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
          <ConnectionBanner />
          
          <Container maxWidth="lg" sx={{ py: 4, pt: 8 }}>
            <Box textAlign="center" mb={4}>
              <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
                FastChat 🚀
              </Typography>
              <Typography variant="h6" color="text.secondary">
                Real-time chat with live presence updates
              </Typography>
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <ChatPane
                  selectedUser={selectedUser}
                  onSendMessage={(message) => {
                    if (selectedUser) {
                      // Add the message to the chat store immediately (optimistic update)
                      const chatStore = useChatStore.getState();
                      chatStore.addMessage({
                        from: getUserIdentity().id,
                        to: selectedUser.user_id,
                        content: message,
                        status: 'sending'
                      });
                      
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

              <Grid item xs={12} lg={4}>
                <OnlineUsers />
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
