import React from 'react';
import { Alert, Box, Chip, Typography } from '@mui/material';
import { usePresenceStore } from '../stores/presence';
import { websocketClient } from '../services/websocket';

const ConnectionBanner: React.FC = () => {
  const { connectionStatus } = usePresenceStore();
  const [networkStatus, setNetworkStatus] = React.useState<'online' | 'offline'>(
    navigator.onLine ? 'online' : 'offline'
  );
  const [connectionInfo, setConnectionInfo] = React.useState<any>(null);

  React.useEffect(() => {
    // Monitor network status
    const handleOnline = () => setNetworkStatus('online');
    const handleOffline = () => setNetworkStatus('offline');
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Update connection info periodically
    const updateConnectionInfo = () => {
      setConnectionInfo(websocketClient.getConnectionInfo());
    };
    
    updateConnectionInfo();
    const interval = setInterval(updateConnectionInfo, 5000);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Don't show banner if connected and online
  if (connectionStatus === 'connected' && networkStatus === 'online') {
    return null;
  }

  const getBannerContent = () => {
    if (networkStatus === 'offline') {
      return {
        severity: 'error' as const,
        title: 'Network Offline',
        message: 'You are currently offline. Messages will be queued and sent when you reconnect.',
        showReconnect: false
      };
    }

    switch (connectionStatus) {
      case 'connecting':
        return {
          severity: 'warning' as const,
          title: 'Connecting...',
          message: 'Attempting to connect to the chat server. This may take a few moments.',
          showReconnect: false
        };
      case 'disconnected':
        return {
          severity: 'error' as const,
          title: 'Connection Lost',
          message: 'Connection to the chat server was lost. Attempting to reconnect automatically...',
          showReconnect: true
        };
      default:
        return {
          severity: 'info' as const,
          title: 'Connection Status',
          message: 'Checking connection status...',
          showReconnect: false
        };
    }
  };

  const banner = getBannerContent();

  return (
    <Alert 
      severity={banner.severity}
      sx={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        borderRadius: 0,
        '& .MuiAlert-message': {
          width: '100%'
        }
      }}
      action={
        <Box display="flex" alignItems="center" gap={1}>
          {banner.showReconnect && (
            <Chip
              label="Reconnect"
              size="small"
              color="primary"
              variant="outlined"
              onClick={() => websocketClient.reconnect()}
              sx={{ cursor: 'pointer' }}
            />
          )}
          {connectionInfo && (
            <Chip
              label={`Quality: ${connectionInfo.quality}`}
              size="small"
              color={connectionInfo.quality === 'excellent' ? 'success' : 
                     connectionInfo.quality === 'good' ? 'warning' : 'error'}
              variant="outlined"
            />
          )}
        </Box>
      }
    >
      <Box display="flex" alignItems="center" gap={2}>
        <Box>
          <Typography variant="subtitle2" fontWeight="bold">
            {banner.title}
          </Typography>
          <Typography variant="body2">
            {banner.message}
          </Typography>
        </Box>
      </Box>
    </Alert>
  );
};

export default ConnectionBanner;
