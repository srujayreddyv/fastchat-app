import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Typography,
  Paper,
  Avatar,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Divider
} from '@mui/material';
import { Send as SendIcon, Person as PersonIcon } from '@mui/icons-material';
import { usePresenceStore } from '../stores/presence';

interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'error';
}

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
}

const ChatPane: React.FC<ChatPaneProps> = ({
  selectedUser,
  onSendMessage,
  messages,
  isTyping,
  onTyping,
  connectionStatus
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const { currentUser } = usePresenceStore();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing indicator
    onTyping(true);

    // Clear typing indicator after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 2000);
  };

  const handleSendMessage = () => {
    if (!inputValue.trim() || !selectedUser) return;

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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageStatusIcon = (status: Message['status']) => {
    switch (status) {
      case 'sending':
        return <CircularProgress size={12} />;
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
      <Paper elevation={2} sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box textAlign="center">
          <PersonIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
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
    <Paper elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Chat Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <Avatar sx={{ bgcolor: selectedUser.online ? 'success.main' : 'grey.500' }}>
            {selectedUser.display_name.charAt(0).toUpperCase()}
          </Avatar>
          <Box flex={1}>
            <Typography variant="h6" component="h2">
              {selectedUser.display_name}
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Chip
                label={selectedUser.online ? 'Online' : 'Offline'}
                size="small"
                color={selectedUser.online ? 'success' : 'default'}
                variant="outlined"
              />
              {connectionStatus !== 'connected' && (
                <Chip
                  label={`${connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}`}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Messages Area */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {messages.length === 0 ? (
          <Box textAlign="center" sx={{ mt: 4 }}>
            <Typography variant="body2" color="text.secondary">
              No messages yet. Start the conversation!
            </Typography>
          </Box>
        ) : (
          messages.map((message) => (
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
                    {formatTime(message.timestamp)}
                  </Typography>
                  {message.from === currentUser?.user_id && getMessageStatusIcon(message.status)}
                </Box>
              </Box>
            </Box>
          ))
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
              <CircularProgress size={16} />
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
        <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>
          {selectedUser.display_name} is offline. Messages will be delivered when they come back online.
        </Alert>
      )}

      {/* Input Area */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Box display="flex" gap={1}>
          <TextField
            ref={inputRef}
            fullWidth
            multiline
            maxRows={4}
            placeholder={isInputDisabled ? "Can't send message..." : "Type a message..."}
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
          severity="error"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default ChatPane;