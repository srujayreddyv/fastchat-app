import React from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { Wifi, WifiOff, HourglassEmpty } from '@mui/icons-material';
import { usePresenceStore } from '../stores/presence';

const ConnectionBanner: React.FC = () => {
  const { connectionStatus } = usePresenceStore();

  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          text: 'Connected',
          severity: 'success' as const,
          icon: <Wifi />
        };
      case 'connecting':
        return {
          text: 'Connecting...',
          severity: 'warning' as const,
          icon: <HourglassEmpty />
        };
      case 'disconnected':
        return {
          text: 'Disconnected',
          severity: 'error' as const,
          icon: <WifiOff />
        };
      default:
        return {
          text: 'Unknown',
          severity: 'info' as const,
          icon: <WifiOff />
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}>
      <Alert 
        severity={config.severity}
        icon={config.icon}
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
