import { getUserIdentity } from '../utils/identity';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

export interface OnlineUser {
  id: string;
  user_id?: string;
  display_name: string;
  last_seen: string;
}

class HeartbeatService {
  private intervalId: number | null = null;
  private isActiveFlag = false;
  private identity = getUserIdentity();

  async sendHeartbeat(): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/presence/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: this.identity.displayName,
          user_id: this.identity.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Only log heartbeat errors in development
      if ((import.meta as any).env?.DEV) {
        console.error('Failed to send heartbeat:', error);
      }
    }
  }

  async getOnlineUsers(): Promise<OnlineUser[]> {
    try {
      // Pass the current user ID to exclude them from the results
      const excludeUserId = this.identity.id;
      
      const response = await fetch(`${API_BASE_URL}/presence/online?exclude_user_id=${excludeUserId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get online users: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.users || [];
    } catch (error) {
      // Only log errors in development
      if ((import.meta as any).env?.DEV) {
        console.error('Failed to get online users:', error);
      }
      return [];
    }
  }

  start(): void {
    if (this.isActiveFlag) return;

    this.isActiveFlag = true;
    this.intervalId = setInterval(() => {
      this.sendHeartbeat();
    }, 30000); // Send heartbeat every 30 seconds

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isActiveFlag = false;
  }

  isActive(): boolean {
    return this.isActiveFlag;
  }
}

export const heartbeatService = new HeartbeatService();
