import { getUserIdentity } from '../utils/identity';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

class HeartbeatService {
  private interval: number | null = null;
  private isRunning = false;
  private intervalMs = 12000; // 12 seconds

  // Start heartbeat loop
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.sendHeartbeat(); // Send immediately

    this.interval = setInterval(() => {
      this.sendHeartbeat();
    }, this.intervalMs);

    console.log('Heartbeat service started');
  }

  // Stop heartbeat loop
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('Heartbeat service stopped');
  }

  // Send heartbeat to server
  private async sendHeartbeat(): Promise<void> {
    try {
      const identity = getUserIdentity();
      
      const response = await fetch(`${API_BASE_URL}/presence/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          display_name: identity.displayName
        })
      });

      if (!response.ok) {
        throw new Error(`Heartbeat failed: ${response.status}`);
      }

      console.log('Heartbeat sent successfully');
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }

  // Get online users
  async getOnlineUsers(): Promise<any[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/presence/online`);
      
      if (!response.ok) {
        throw new Error(`Failed to get online users: ${response.status}`);
      }

      const data = await response.json();
      return data.users || [];
    } catch (error) {
      console.error('Failed to get online users:', error);
      return [];
    }
  }

  // Check if service is running
  isActive(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const heartbeatService = new HeartbeatService();
