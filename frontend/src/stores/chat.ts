import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { getUserIdentity } from '../utils/identity';
import { usePresenceStore } from './presence';

const CHAT_STATE_KEY = 'fastchat_chat_state';

export interface Message {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  status: 'sending' | 'sent' | 'pending' | 'error';
}

export interface ChatSession {
  user_id: string;
  display_name: string;
  messages: Message[];
  isTyping: boolean;
  isActive: boolean; // Track if the chat session is established
  chat_id?: string; // Store the backend chat ID
}

interface ChatState {
  selectedUser: {
    user_id: string;
    display_name: string;
    online: boolean;
  } | null;
  chatSessions: Record<string, ChatSession>;
}

interface ChatStore extends ChatState {
  // State
  typingUsers: Record<string, boolean>;
  
  // Actions
  setSelectedUser: (user: { user_id: string; display_name: string; online: boolean } | null) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessageStatus: (messageId: string, status: Message['status']) => void;
  setTyping: (userId: string, isTyping: boolean) => void;
  clearChat: (userId: string) => void;
  getMessagesForUser: (userId: string) => Message[];
  isUserTyping: (userId: string) => boolean;
  setChatActive: (userId: string, chatId: string) => void;
  isChatActive: (userId: string) => boolean;
  saveChatState: () => void;
  loadChatState: () => void;
  restoreActiveChat: () => Promise<void>;
  sortAllMessages: () => void;
}

// Helper functions for persistence
const saveToChatStorage = (state: ChatState) => {
  try {
    // Sort all messages before saving
    const sortedState = {
      selectedUser: state.selectedUser,
      chatSessions: { ...state.chatSessions }
    };
    
    // Sort messages in each session
    Object.keys(sortedState.chatSessions).forEach((userId) => {
      const session = sortedState.chatSessions[userId];
      if (session.messages && session.messages.length > 0) {
        sortedState.chatSessions[userId] = {
          ...session,
          messages: [...session.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        };
      }
    });
    
    sessionStorage.setItem(CHAT_STATE_KEY, JSON.stringify(sortedState));
  } catch (error) {
    if ((import.meta as any).env?.DEV) {
      console.error('Failed to save chat state:', error);
    }
  }
};

const loadFromChatStorage = (): Partial<ChatState> => {
  try {
    const stored = sessionStorage.getItem(CHAT_STATE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Restore message timestamps as Date objects and sort them
      if (parsed.chatSessions) {
        Object.values(parsed.chatSessions).forEach((session: any) => {
          if (session.messages) {
            session.messages.forEach((msg: any) => {
              msg.timestamp = new Date(msg.timestamp);
            });
            // Sort messages chronologically
            session.messages.sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime());
          }
        });
      }
      return parsed;
    }
  } catch (error) {
    if ((import.meta as any).env?.DEV) {
      console.error('Failed to load chat state:', error);
    }
  }
  return {};
};

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initial state
  selectedUser: null,
  chatSessions: {},
  typingUsers: {},

  // Actions
  setSelectedUser: (user) => {
    set({ selectedUser: user });
    
    // Initialize chat session if it doesn't exist
    if (user && !get().chatSessions[user.user_id]) {
      set((state) => ({
        chatSessions: {
          ...state.chatSessions,
          [user.user_id]: {
            user_id: user.user_id,
            display_name: user.display_name,
            messages: [],
            isTyping: false,
            isActive: true, // Auto-activate when user is selected
          },
        },
      }));
    } else if (user && get().chatSessions[user.user_id]) {
      // If session exists, ensure it's active
      set((state) => ({
        chatSessions: {
          ...state.chatSessions,
          [user.user_id]: {
            ...state.chatSessions[user.user_id],
            isActive: true,
          },
        },
      }));
    }
    
    // Save state after setting selected user
    get().saveChatState();
  },

  addMessage: (messageData: Omit<Message, 'id' | 'timestamp'> & { message_id?: string; timestamp?: string }) => {
    // Validate message data
    if (!messageData.from || !messageData.to || !messageData.content) {
      if ((import.meta as any).env?.DEV) {
        console.error('Invalid message data:', messageData);
      }
      return;
    }
    
    // Parse timestamp correctly
    let timestamp: Date;
    if (messageData.timestamp) {
      // Handle both ISO string and Date object
      if (typeof messageData.timestamp === 'string') {
        // Parse ISO string - this will handle timezone information correctly
        timestamp = new Date(messageData.timestamp);
      } else {
        timestamp = messageData.timestamp;
      }
    } else {
      // For optimistic updates (sending), create a timestamp that will be consistent
      // Use the same format as server timestamps to ensure consistency
      timestamp = new Date();
    }
    
    const message: Message = {
      ...messageData,
      id: messageData.message_id || uuidv4(), // Use server message_id if available
      timestamp: timestamp,
    };

    set((state) => {
      // Get the current user's ID from the identity
      const currentUserId = getUserIdentity().id;
      
      // Determine which user's chat session this message belongs to
      // For sent messages (from === currentUserId): add to recipient's session
      // For received messages (from !== currentUserId): add to sender's session
      const otherUserId = messageData.from === currentUserId 
        ? messageData.to 
        : messageData.from;
      
      const existingSession = state.chatSessions[otherUserId];
      
      if (existingSession) {
        // Check if this is a server message that should replace an optimistic message
        const existingMessageIndex = existingSession.messages.findIndex(msg => 
          msg.content === message.content && 
          msg.from === message.from && 
          msg.status === 'sending' &&
          !('message_id' in msg) // Optimistic messages don't have message_id property
        );
        
        let updatedMessages;
        if (existingMessageIndex >= 0 && messageData.message_id) {
          // Replace optimistic message with server message
          updatedMessages = [...existingSession.messages];
          updatedMessages[existingMessageIndex] = message;
          
        } else {
          // Add message to existing session and sort chronologically
          updatedMessages = [...existingSession.messages, message];
        }
        
        // Sort messages by timestamp (oldest first)
        updatedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        // Remove duplicates based on message ID
        const uniqueMessages = updatedMessages.filter((msg, index, self) => 
          index === self.findIndex(m => m.id === msg.id)
        );
        
        return {
          chatSessions: {
            ...state.chatSessions,
            [otherUserId]: {
              ...existingSession,
              messages: uniqueMessages,
              // Auto-activate chat if it's a new message from someone else
              isActive: messageData.from !== currentUserId ? true : existingSession.isActive,
            },
          },
        };
      } else {
        // Create new session if it doesn't exist
        // Try to get display name from various sources
        let displayName = 'Unknown User';
        
        // First try selected user
        const selectedUser = get().selectedUser;
        if (selectedUser && selectedUser.user_id === otherUserId) {
          displayName = selectedUser.display_name;
        } else {
          // Try to get from presence store
          const presenceStore = usePresenceStore.getState();
          const onlineUser = presenceStore.onlineUsers.find(u => u.user_id === otherUserId);
          if (onlineUser) {
            displayName = onlineUser.display_name;
          }
        }
          
        return {
          chatSessions: {
            ...state.chatSessions,
            [otherUserId]: {
              user_id: otherUserId,
              display_name: displayName,
              messages: [message],
              isTyping: false,
              isActive: messageData.from !== currentUserId, // Auto-activate for incoming messages
            },
          },
        };
      }
    });
    
    // Save state after adding message
    get().saveChatState();
  },

  updateMessageStatus: (messageId: string, status: Message['status']) => {
    set((state) => {
      const updatedSessions = { ...state.chatSessions };
      
      Object.keys(updatedSessions).forEach(userId => {
        const session = updatedSessions[userId];
        const messageIndex = session.messages.findIndex(msg => msg.id === messageId);
        
        if (messageIndex >= 0) {
          updatedSessions[userId] = {
            ...session,
            messages: session.messages.map((msg, index) => 
              index === messageIndex ? { ...msg, status } : msg
            )
          };
        }
      });
      
      return { chatSessions: updatedSessions };
    });
  },

  setTyping: (userId, isTyping) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [userId]: isTyping,
      },
    }));
  },

  clearChat: (userId) => {
    set((state) => {
      const updatedSessions = { ...state.chatSessions };
      delete updatedSessions[userId];
      return { chatSessions: updatedSessions };
    });
  },

  getMessagesForUser: (userId: string) => {
    const session = get().chatSessions[userId];
    if (!session) return [];
    
    // Ensure messages are sorted chronologically
    return [...session.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  },

  isUserTyping: (userId) => {
    return get().typingUsers[userId] || false;
  },

  setChatActive: (userId, chatId) => {
    set((state) => {
      const existingSession = state.chatSessions[userId];
      if (existingSession) {
        return {
          chatSessions: {
            ...state.chatSessions,
            [userId]: {
              ...existingSession,
              isActive: true,
              chat_id: chatId,
            },
          },
        };
      }
      return state;
    });
    
    // Save state after setting chat active
    get().saveChatState();
  },

  isChatActive: (userId) => {
    const session = get().chatSessions[userId];
    return session ? session.isActive : false;
  },

  saveChatState: () => {
    const state = get();
    saveToChatStorage({
      selectedUser: state.selectedUser,
      chatSessions: state.chatSessions
    });
  },

  loadChatState: () => {
    const loadedState = loadFromChatStorage();
    if (loadedState.chatSessions) {
      set((state) => ({
        ...state,
        ...loadedState
      }));
      
      // Ensure all messages are sorted after loading
      get().sortAllMessages();
      
      if ((import.meta as any).env?.DEV) {
        console.log('Chat state loaded:', loadedState);
      }
    }
  },

  // Sort all messages in all chat sessions
  sortAllMessages: () => {
    set((state) => {
      const updatedSessions = { ...state.chatSessions };
      
      Object.keys(updatedSessions).forEach((userId) => {
        const session = updatedSessions[userId];
        if (session.messages && session.messages.length > 0) {
          updatedSessions[userId] = {
            ...session,
            messages: [...session.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
          };
        }
      });
      
      return { chatSessions: updatedSessions };
    });
  },

  restoreActiveChat: async () => {
    const state = get();
    if (state.selectedUser && state.selectedUser.user_id) {
      // Check if the selected user is still online
      const presenceStore = usePresenceStore.getState();
      const isUserOnline = presenceStore.onlineUsers.some(
        user => user.user_id === state.selectedUser?.user_id
      );
      
      if (isUserOnline) {
        // Re-establish chat connection with backend
        const { websocketClient } = await import('../services/websocket');
        websocketClient.openChat(state.selectedUser.user_id, state.selectedUser.display_name);
      } else {
        // User is no longer online, clear the selected user
        set({ selectedUser: null });
        get().saveChatState();
      }
    }
  },
}));
