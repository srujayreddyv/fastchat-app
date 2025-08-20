import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

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
}

interface ChatStore {
  // State
  selectedUser: {
    user_id: string;
    display_name: string;
    online: boolean;
  } | null;
  chatSessions: Record<string, ChatSession>;
  typingUsers: Record<string, boolean>;
  
  // Actions
  setSelectedUser: (user: { user_id: string; display_name: string; online: boolean } | null) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateMessageStatus: (messageId: string, status: Message['status']) => void;
  setTyping: (userId: string, isTyping: boolean) => void;
  clearChat: (userId: string) => void;
  getMessagesForUser: (userId: string) => Message[];
  isUserTyping: (userId: string) => boolean;
}

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
          },
        },
      }));
    }
  },

  addMessage: (messageData) => {
    const message: Message = {
      ...messageData,
      id: uuidv4(),
      timestamp: new Date(),
    };

    set((state) => {
      const userId = messageData.from === get().selectedUser?.user_id 
        ? messageData.to 
        : messageData.from;
      
      const existingSession = state.chatSessions[userId];
      
      if (existingSession) {
        return {
          chatSessions: {
            ...state.chatSessions,
            [userId]: {
              ...existingSession,
              messages: [...existingSession.messages, message],
            },
          },
        };
      } else {
        // Create new session if it doesn't exist
        return {
          chatSessions: {
            ...state.chatSessions,
            [userId]: {
              user_id: userId,
              display_name: messageData.from === get().selectedUser?.user_id 
                ? 'Unknown User' 
                : messageData.from,
              messages: [message],
              isTyping: false,
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
}));
