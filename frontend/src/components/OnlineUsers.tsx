import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  List, 
  ListItem, 
  ListItemAvatar, 
  ListItemText, 
  Avatar, 
  Chip, 
  Divider,
  Box,
  Button
} from '@mui/material';
import { 
  Circle as CircleIcon, 
  Person as PersonIcon,
  Chat as ChatIcon 
} from '@mui/icons-material';
import { usePresenceStore } from '../stores/presence';
import { useChatStore } from '../stores/chat';
import { websocketClient } from '../services/websocket';
import { getUserIdentity } from '../utils/identity';

const OnlineUsers: React.FC = () => {
  const { onlineUsers, currentUser } = usePresenceStore();
  const { selectedUser, setSelectedUser } = useChatStore();
  const identity = getUserIdentity();

  const handleUserClick = (userId: string, displayName: string) => {
    // Don't allow chatting with yourself
    if (userId === identity.id) return;
    
    // Set selected user in chat store
    setSelectedUser({
      user_id: userId,
      display_name: displayName,
      online: true
    });
    
    // Open chat via WebSocket
    websocketClient.openChat(userId, displayName);
  };

  const filteredUsers = onlineUsers.filter(user => user.user_id !== identity.id);

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Online Users ({filteredUsers.length})
        </Typography>
        
        {filteredUsers.length === 0 ? (
          <Box textAlign="center" py={3}>
            <Typography variant="body2" color="text.secondary">
              No other users online
            </Typography>
          </Box>
        ) : (
          <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
            {filteredUsers.map((user) => (
              <ListItem
                key={user.user_id}
                alignItems="center"
                selected={selectedUser?.user_id === user.user_id}
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  borderRadius: 1,
                  mb: 1,
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    '&:hover': {
                      bgcolor: 'primary.light',
                    }
                  }
                }}
                onClick={() => handleUserClick(user.user_id, user.display_name)}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                    <PersonIcon fontSize="small" />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={user.display_name}
                  secondary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <CircleIcon sx={{ fontSize: 12, color: 'success.main' }} />
                      <Typography variant="caption" color="text.secondary">
                        Online
                      </Typography>
                    </Box>
                  }
                />
                <Button
                  size="small"
                  startIcon={<ChatIcon />}
                  variant="outlined"
                  color="primary"
                >
                  Chat
                </Button>
              </ListItem>
            ))}
          </List>
        )}
        
        <Divider sx={{ my: 2 }} />
        
        {/* Current user info */}
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
            <PersonIcon fontSize="small" />
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight="medium">
              You ({identity.displayName})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Current user
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default OnlineUsers;
