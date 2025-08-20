import { useEffect } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Grid, 
  Card, 
  CardContent,
  ThemeProvider,
  createTheme,
  CssBaseline
} from '@mui/material';
import { Chat as ChatIcon } from '@mui/icons-material';
import ConnectionBanner from './components/ConnectionBanner';
import OnlineUsers from './components/OnlineUsers';
import { websocketClient } from './services/websocket';
import { heartbeatService } from './services/heartbeat';
import { usePresenceStore } from './stores/presence';
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
  const { 
    setOnlineUsers, 
    addOnlineUser, 
    removeOnlineUser, 
    updateConnectionStatus,
    setCurrentUser 
  } = usePresenceStore();

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
    };

    // Register event handlers
    websocketClient.on('connected', handleConnected);
    websocketClient.on('disconnected', handleDisconnected);
    websocketClient.on('connecting', handleConnecting);
    websocketClient.on('presence', handlePresence);
    websocketClient.on('error', handleError);

    // Cleanup on unmount
    return () => {
      websocketClient.off('connected', handleConnected);
      websocketClient.off('disconnected', handleDisconnected);
      websocketClient.off('connecting', handleConnecting);
      websocketClient.off('presence', handlePresence);
      websocketClient.off('error', handleError);
      
      websocketClient.disconnect();
      heartbeatService.stop();
    };
  }, [setOnlineUsers, addOnlineUser, removeOnlineUser, updateConnectionStatus, setCurrentUser]);

  return (
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
              <Card elevation={2}>
                <CardContent sx={{ p: 3 }}>
                  <Box display="flex" alignItems="center" gap={1} mb={2}>
                    <ChatIcon color="primary" />
                    <Typography variant="h5" component="h2">
                      Chat Area
                    </Typography>
                  </Box>
                  <Box 
                    sx={{ 
                      bgcolor: 'grey.50', 
                      p: 3, 
                      borderRadius: 1,
                      textAlign: 'center'
                    }}
                  >
                    <Typography color="text.secondary">
                      Select a user from the online users list to start chatting
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} lg={4}>
              <OnlineUsers />
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App
