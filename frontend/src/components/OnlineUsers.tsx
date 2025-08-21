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
  Divider,
  Box,
  Button
} from '@mui/material';
import { 
  Circle as CircleIcon, 
  Person as PersonIcon,
  Chat as ChatIcon 
} from '@mui/icons-material';
import { Badge, CircularProgress } from '@mui/material';
import { usePresenceStore } from '../stores/presence';
import { useChatStore } from '../stores/chat';
import { websocketClient } from '../services/websocket';
import { getUserIdentity } from '../utils/identity';

const OnlineUsers: React.FC = () => {
  const { onlineUsers, isLoadingUsers } = usePresenceStore();
  const { selectedUser, setSelectedUser, chatSessions } = useChatStore();
  const identity = getUserIdentity();
  
  // Count unread messages for each user
  const getUnreadCount = (userId: string) => {
    const session = chatSessions[userId];
    if (!session) return 0;
    
    // For now, we'll consider all messages as read when the user is selected
    // In a real app, you'd track read/unread status per message
    return selectedUser?.user_id === userId ? 0 : session.messages.length;
  };

  const handleUserClick = (userId: string, displayName: string) => {
    // Don't allow chatting with yourself
    if (userId === identity.id) return;
    
    // Check if we're already chatting with this user
    const currentSelectedUser = selectedUser;
    if (currentSelectedUser && currentSelectedUser.user_id === userId) {
      // Already chatting with this user, no need to open chat again
      return;
    }
    
    // Set selected user in chat store
    setSelectedUser({
      user_id: userId,
      display_name: displayName,
      online: true
    });
    
    // Open chat via WebSocket (this will establish the chat session)
    websocketClient.openChat(userId, displayName);
  };

  // Double-check: filter out current user from online users list
  const filteredUsers = onlineUsers.filter(user => user.user_id !== identity.id);

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Online Users ({filteredUsers.length})
        </Typography>
        
        {isLoadingUsers ? (
          <Box textAlign="center" py={3}>
            <CircularProgress size={24} sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Loading users...
            </Typography>
          </Box>
        ) : filteredUsers.length === 0 ? (
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
                  <Badge 
                    badgeContent={getUnreadCount(user.user_id)} 
                    color="error"
                    invisible={getUnreadCount(user.user_id) === 0}
                  >
                    <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
                      <PersonIcon fontSize="small" />
                    </Avatar>
                  </Badge>
                </ListItemAvatar>
                <ListItemText
                  primary={user.display_name}
                  secondary={
                    <React.Fragment>
                      <CircleIcon sx={{ fontSize: 12, color: 'success.main', mr: 0.5, verticalAlign: 'middle' }} />
                      <Typography component="span" variant="caption" color="text.secondary">
                        Online
                      </Typography>
                    </React.Fragment>
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
