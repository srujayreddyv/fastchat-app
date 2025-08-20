import { useEffect, useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Snackbar,
  Alert
} from '@mui/material';
import { Chat as ChatIcon } from '@mui/icons-material';
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
    isUserTyping
  } = useChatStore();

  useEffect(() => {
    const identity = getUserIdentity();
    
    // Set current user
    setCurrentUser({
      user_id: identity.id,
      display_name: identity.displayName,
      online: true
    });

    // Connect to WebSocket
    websocketClient.connect();

    // Start heartbeat service
    heartbeatService.start();

    // WebSocket event handlers
    const handleConnected = () => {
      updateConnectionStatus('connected');
    };

    const handleDisconnected = () => {
      updateConnectionStatus('disconnected');
    };

    const handleConnecting = () => {
      updateConnectionStatus('connecting');
    };

    const handlePresence = (data: any) => {
      if (data.users) {
        setOnlineUsers(data.users);
      }
    };

               const handleError = (error: any) => {
             console.error('WebSocket error:', error);
             setErrorMessage(error.message || 'An error occurred');
             setShowError(true);
           };

               // Chat event handlers
           const handleMessage = (data: any) => {
             console.log('Message received:', data);
           };

           const handleTyping = (data: any) => {
             console.log('Typing indicator:', data);
           };

           // Register event handlers
           websocketClient.on('connected', handleConnected);
           websocketClient.on('disconnected', handleDisconnected);
           websocketClient.on('connecting', handleConnecting);
           websocketClient.on('presence', handlePresence);
           websocketClient.on('message', handleMessage);
           websocketClient.on('typing', handleTyping);
           websocketClient.on('error', handleError);

           // Cleanup on unmount
           return () => {
             websocketClient.off('connected', handleConnected);
             websocketClient.off('disconnected', handleDisconnected);
             websocketClient.off('connecting', handleConnecting);
             websocketClient.off('presence', handlePresence);
             websocketClient.off('message', handleMessage);
             websocketClient.off('typing', handleTyping);
             websocketClient.off('error', handleError);

             websocketClient.disconnect();
             heartbeatService.stop();
           };
         }, [setOnlineUsers, addOnlineUser, removeOnlineUser, updateConnectionStatus, setCurrentUser]);

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
                      websocketClient.sendMessage(selectedUser.user_id, message);
                    }
                  }}
                  messages={selectedUser ? getMessagesForUser(selectedUser.user_id) : []}
                  isTyping={selectedUser ? isUserTyping(selectedUser.user_id) : false}
                  onTyping={(isTyping) => {
                    websocketClient.sendTyping(isTyping);
                  }}
                  connectionStatus={usePresenceStore.getState().connectionStatus}
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
