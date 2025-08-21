import { create } from 'zustand';
import { OnlineUser } from '../services/websocket';

interface PresenceState {
  onlineUsers: OnlineUser[];
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  currentUser: OnlineUser | null;
  isLoadingUsers: boolean;
  setOnlineUsers: (users: OnlineUser[]) => void;
  addOnlineUser: (user: OnlineUser) => void;
  removeOnlineUser: (userId: string) => void;
  updateConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected') => void;
  setCurrentUser: (user: OnlineUser) => void;
  setLoadingUsers: (loading: boolean) => void;
  clearPresence: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  onlineUsers: [],
  connectionStatus: 'disconnected',
  currentUser: null,
  isLoadingUsers: false,

  setOnlineUsers: (users: OnlineUser[]) => {
    set({ onlineUsers: users });
  },

  addOnlineUser: (user: OnlineUser) => {
    set((state) => {
      const existingUserIndex = state.onlineUsers.findIndex(u => u.user_id === user.user_id);
      
      if (existingUserIndex >= 0) {
        // Update existing user
        const updatedUsers = [...state.onlineUsers];
        updatedUsers[existingUserIndex] = user;
        return { onlineUsers: updatedUsers };
      } else {
        // Add new user
        return { onlineUsers: [...state.onlineUsers, user] };
      }
    });
  },

  removeOnlineUser: (userId: string) => {
    set((state) => ({
      onlineUsers: state.onlineUsers.filter(user => user.user_id !== userId)
    }));
  },

  updateConnectionStatus: (status: 'connecting' | 'connected' | 'disconnected') => {
    set({ connectionStatus: status });
  },

  setCurrentUser: (user: OnlineUser) => {
    set({ currentUser: user });
  },

  setLoadingUsers: (loading: boolean) => {
    set({ isLoadingUsers: loading });
  },

  clearPresence: () => {
    set({
      onlineUsers: [],
      connectionStatus: 'disconnected',
      currentUser: null,
      isLoadingUsers: false
    });
  }
}));
