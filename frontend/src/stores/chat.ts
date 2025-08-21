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
  status: 'sending' | 'sent' | 'error';
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
}

// Helper functions for persistence
const saveToChatStorage = (state: ChatState) => {
  try {
    const chatState = {
      selectedUser: state.selectedUser,
      chatSessions: state.chatSessions
    };
    sessionStorage.setItem(CHAT_STATE_KEY, JSON.stringify(chatState));
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
      // Restore message timestamps as Date objects
      if (parsed.chatSessions) {
        Object.values(parsed.chatSessions).forEach((session: any) => {
          if (session.messages) {
            session.messages.forEach((msg: any) => {
              msg.timestamp = new Date(msg.timestamp);
            });
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

  addMessage: (messageData) => {
    const message: Message = {
      ...messageData,
      id: uuidv4(),
      timestamp: new Date(),
    };

    set((state) => {
      // Get the current user's ID from the identity
      const currentUserId = getUserIdentity().id;
      
      // Determine which user's chat session this message belongs to
      // If I sent the message (from === currentUserId), add to recipient's session
      // If I received the message (from !== currentUserId), add to sender's session
      const otherUserId = messageData.from === currentUserId 
        ? messageData.to 
        : messageData.from;
      
      const existingSession = state.chatSessions[otherUserId];
      
      if (existingSession) {
        return {
          chatSessions: {
            ...state.chatSessions,
            [otherUserId]: {
              ...existingSession,
              messages: [...existingSession.messages, message],
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
              isActive: true, // Auto-activate when we receive a message
            },
          },
        };
      }
    });
  },

  updateMessageStatus: (messageId, status) => {
    set((state) => {
      const updatedSessions = { ...state.chatSessions };
      
      Object.keys(updatedSessions).forEach((userId) => {
        const session = updatedSessions[userId];
        const messageIndex = session.messages.findIndex(msg => msg.id === messageId);
        
        if (messageIndex !== -1) {
          updatedSessions[userId] = {
            ...session,
            messages: session.messages.map((msg, index) =>
              index === messageIndex ? { ...msg, status } : msg
            ),
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

  getMessagesForUser: (userId) => {
    const session = get().chatSessions[userId];
    return session ? session.messages : [];
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
    const savedState = loadFromChatStorage();
    if (savedState.selectedUser || savedState.chatSessions) {
      set((state) => ({
        ...state,
        selectedUser: savedState.selectedUser || state.selectedUser,
        chatSessions: savedState.chatSessions || state.chatSessions,
      }));
    }
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
