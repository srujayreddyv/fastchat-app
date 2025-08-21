import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Paper, 
  TextField, 
  IconButton, 
  Typography, 
  Avatar, 
  Snackbar,
  Alert
} from '@mui/material';
import { Send as SendIcon, Person as PersonIcon } from '@mui/icons-material';
import { useChatStore } from '../stores/chat';
import { usePresenceStore } from '../stores/presence';
import { getUserIdentity } from '../utils/identity';
import { Message } from '../stores/chat';

// Utility function to format timestamps consistently
const formatMessageTime = (timestamp: Date): string => {
  const now = new Date();
  const messageDate = new Date(timestamp);
  
  // Check if it's today
  const isToday = messageDate.toDateString() === now.toDateString();
  
  if (isToday) {
    // Show time only for today's messages
    return messageDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  } else {
    // Show date and time for older messages
    return messageDate.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
};

interface ChatPaneProps {
  selectedUser: {
    user_id: string;
    display_name: string;
    online: boolean;
  } | null;
  onSendMessage: (message: string) => void;
  messages: Message[];
  isTyping: boolean;
  onTyping: (isTyping: boolean) => void;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  isChatActive: boolean;
}

const ChatPane: React.FC<ChatPaneProps> = ({
  selectedUser,
  onSendMessage,
  messages,
  isTyping,
  onTyping,
  connectionStatus,
  // isChatActive - removed unused prop
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<number>();
  const lastMessageCountRef = useRef<number>(0);

  const { currentUser } = usePresenceStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show notification for new messages when chat is not active
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current && selectedUser) {
      const newMessages = messages.slice(lastMessageCountRef.current);
      const unreadMessages = newMessages.filter(msg => msg.from !== currentUser?.user_id);
      
      if (unreadMessages.length > 0 && !document.hasFocus()) {
        setNotificationMessage(`New message from ${selectedUser.display_name}`);
        setShowSnackbar(true);
      }
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, selectedUser, currentUser]);

  // Handle typing indicator with debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Only send typing indicator if we haven't sent one recently
    const chatStore = useChatStore.getState();
    const isCurrentlyTyping = chatStore.isUserTyping(getUserIdentity().id);
    
    if (!isCurrentlyTyping) {
      onTyping(true);
    }

    // Clear typing indicator after 1.5 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || !selectedUser) {
      return;
    }

    onSendMessage(inputValue.trim());
    setInputValue('');
    onTyping(false);
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isInputDisabled = !selectedUser || !selectedUser.online || connectionStatus !== 'connected';
  
  // ChatPane is ready for messaging

  const getMessageStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sending':
        return <Typography variant="caption" color="text.secondary">⏳</Typography>;
      case 'sent':
        return <Typography variant="caption" color="text.secondary">✓</Typography>;
      case 'error':
        return <Typography variant="caption" color="error">✗</Typography>;
      default:
        return null;
    }
  };

  if (!selectedUser) {
    return (
      <Paper elevation={2} sx={{ 
        height: { xs: '50vh', sm: '60vh', md: '70vh' }, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Box textAlign="center">
          <PersonIcon sx={{ fontSize: { xs: 48, sm: 56, md: 64 }, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Select a user to start chatting
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose someone from the online users list
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ 
      height: { xs: '50vh', sm: '60vh', md: '70vh' }, 
      display: 'flex', 
      flexDirection: 'column' 
    }}>
      {/* Chat Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1, 
        p: 2, 
        borderBottom: 1, 
        borderColor: 'divider',
        flexShrink: 0
      }}>
        <Avatar sx={{ bgcolor: 'success.main', width: 32, height: 32 }}>
          <PersonIcon fontSize="small" />
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight="medium">
            {selectedUser.display_name}
          </Typography>
          <Typography variant="caption" color="success.main" display="flex" alignItems="center" gap={0.5}>
            <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
            Online
          </Typography>
        </Box>
      </Box>

      {/* Messages Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {messages.length === 0 ? (
          <Box textAlign="center" sx={{ mt: 4, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              No messages yet. Start the conversation!
            </Typography>
          </Box>
        ) : (
          messages.map((message) => {
            return (
              <Box
                key={message.id}
                display="flex"
                justifyContent={message.from === currentUser?.user_id ? 'flex-end' : 'flex-start'}
                mb={1}
              >
                <Box
                  sx={{
                    maxWidth: '70%',
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: message.from === currentUser?.user_id ? 'primary.main' : 'grey.100',
                    color: message.from === currentUser?.user_id ? 'white' : 'text.primary',
                    position: 'relative'
                  }}
                >
                  <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                    {message.content}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {formatMessageTime(message.timestamp)}
                    </Typography>
                    {message.from === currentUser?.user_id && getMessageStatusIcon(message.status)}
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
        
        {/* Typing Indicator */}
        {isTyping && (
          <Box display="flex" justifyContent="flex-start" mb={1}>
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: 'grey.100',
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {selectedUser.display_name} is typing...
              </Typography>
            </Box>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>

      {/* Offline Banner */}
      {!selectedUser.online && (
        <Alert severity="warning" sx={{ mx: 2, mb: 2, flexShrink: 0 }}>
          {selectedUser.display_name} is offline. Messages will be delivered when they come back online.
        </Alert>
      )}

      {/* Input Area */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Box display="flex" gap={1}>
          <TextField
            ref={inputRef}
            fullWidth
            multiline
            maxRows={4}
            placeholder={
              !selectedUser.online ? "User is offline..." :
              connectionStatus !== 'connected' ? "Connecting..." :
              "Type a message..."
            }
            value={inputValue}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            disabled={isInputDisabled}
            variant="outlined"
            size="small"
          />
          <IconButton
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isInputDisabled}
            color="primary"
            sx={{ alignSelf: 'flex-end' }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Error Snackbar */}
      <Snackbar
        open={showSnackbar}
        autoHideDuration={6000}
        onClose={() => setShowSnackbar(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setShowSnackbar(false)}
          severity="info" // Changed to info for notifications
          sx={{ width: '100%' }}
        >
          {notificationMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default ChatPane;