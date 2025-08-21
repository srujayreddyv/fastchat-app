import React from 'react';
import { Alert, Box, Typography, Button } from '@mui/material';
import { Wifi, WifiOff, HourglassEmpty, Refresh } from '@mui/icons-material';
import { usePresenceStore } from '../stores/presence';
import { websocketClient } from '../services/websocket';

const ConnectionBanner: React.FC = () => {
  const { connectionStatus } = usePresenceStore();

  const handleReconnect = () => {
    websocketClient.reconnect();
  };

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          text: 'Connected',
          severity: 'success' as const,
          icon: <Wifi />,
          showReconnect: false
        };
      case 'connecting':
        return {
          text: 'Connecting...',
          severity: 'warning' as const,
          icon: <HourglassEmpty />,
          showReconnect: false
        };
      case 'disconnected':
        return {
          text: 'Disconnected',
          severity: 'error' as const,
          icon: <WifiOff />,
          showReconnect: true
        };
      default:
        return {
          text: 'Unknown',
          severity: 'info' as const,
          icon: <WifiOff />,
          showReconnect: false
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}>
      <Alert 
        severity={config.severity}
        icon={config.icon}
        action={
          config.showReconnect ? (
            <Button
              color="inherit"
              size="small"
              startIcon={<Refresh />}
              onClick={handleReconnect}
              sx={{ ml: 1 }}
            >
              Reconnect
            </Button>
          ) : undefined
        }
        sx={{ 
          borderRadius: 0,
          '& .MuiAlert-message': {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%'
          }
        }}
      >
        <Typography variant="body2" fontWeight="medium">
          {config.text}
        </Typography>
      </Alert>
    </Box>
  );
};

export default ConnectionBanner;
