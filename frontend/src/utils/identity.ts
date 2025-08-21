import { v4 as uuidv4 } from 'uuid';

export interface UserIdentity {
  id: string;
  displayName: string;
  createdAt: string;
  sessionId?: string; // Add session ID for unique tab identification
}

// const IDENTITY_KEY = 'fastchat_user_identity'; // Removed unused constant
const SESSION_ID_KEY = 'fastchat_session_id';
const SESSION_USER_ID_KEY = 'fastchat_session_user_id';
const SESSION_DISPLAY_NAME_KEY = 'fastchat_session_display_name';
const SESSION_CREATED_AT_KEY = 'fastchat_session_created_at';

// Generate a random display name
function generateRandomName(): string {
  const adjectives = [
    'Swift', 'Bright', 'Clever', 'Witty', 'Charming', 'Bold', 'Calm', 'Eager',
    'Friendly', 'Gentle', 'Happy', 'Kind', 'Lively', 'Merry', 'Noble', 'Proud',
    'Quick', 'Smart', 'Tender', 'Warm', 'Zealous', 'Ambitious', 'Brave', 'Creative'
  ];
  
  const nouns = [
    'Panda', 'Tiger', 'Eagle', 'Dolphin', 'Phoenix', 'Wolf', 'Lion', 'Bear',
    'Fox', 'Owl', 'Shark', 'Dragon', 'Unicorn', 'Penguin', 'Koala', 'Elephant',
    'Giraffe', 'Zebra', 'Kangaroo', 'Koala', 'Platypus', 'Narwhal', 'Axolotl'
  ];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const number = Math.floor(Math.random() * 999) + 1;
  
  return `${adjective}${noun}${number}`;
}

// Get or create user identity
export function getUserIdentity(): UserIdentity {
  // Check if we have a session-specific user ID
  let sessionUserId = sessionStorage.getItem(SESSION_USER_ID_KEY);
  
  if (!sessionUserId) {
    // Generate a unique user ID for this tab/session
    sessionUserId = uuidv4();
    sessionStorage.setItem(SESSION_USER_ID_KEY, sessionUserId);
  }
  
  // Check if we have a session-specific display name
  let sessionDisplayName = sessionStorage.getItem(SESSION_DISPLAY_NAME_KEY);
  
  if (!sessionDisplayName) {
    // Generate a unique display name for this tab/session
    sessionDisplayName = generateRandomName();
    sessionStorage.setItem(SESSION_DISPLAY_NAME_KEY, sessionDisplayName);
  }
  
  // Generate unique session ID for this tab
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = uuidv4();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  
  // Get or create consistent timestamp for this session
  let sessionCreatedAt = sessionStorage.getItem(SESSION_CREATED_AT_KEY);
  if (!sessionCreatedAt) {
    sessionCreatedAt = new Date().toISOString();
    sessionStorage.setItem(SESSION_CREATED_AT_KEY, sessionCreatedAt);
  }
  
  // Return identity with session-specific user ID and display name
  return {
    id: sessionUserId, // Use session-specific user ID
    displayName: sessionDisplayName, // Use session-specific display name
    createdAt: sessionCreatedAt, // Use consistent timestamp for session
    sessionId: sessionId
  };
}

// Update display name
export function updateDisplayName(newName: string): UserIdentity {
  // Store the new display name in sessionStorage for this tab
  sessionStorage.setItem(SESSION_DISPLAY_NAME_KEY, newName);
  
  // Get the current identity with the updated display name
  return getUserIdentity();
}

// Clear identity (for logout)
export function clearIdentity(): void {
  sessionStorage.removeItem(SESSION_DISPLAY_NAME_KEY);
  sessionStorage.removeItem(SESSION_ID_KEY);
  sessionStorage.removeItem(SESSION_USER_ID_KEY);
  sessionStorage.removeItem(SESSION_CREATED_AT_KEY);
}

// Check if identity exists
export function hasIdentity(): boolean {
  return sessionStorage.getItem(SESSION_DISPLAY_NAME_KEY) !== null;
}

// Get consistent timestamp for current session
export function getSessionTimestamp(): string {
  let sessionCreatedAt = sessionStorage.getItem(SESSION_CREATED_AT_KEY);
  if (!sessionCreatedAt) {
    sessionCreatedAt = new Date().toISOString();
    sessionStorage.setItem(SESSION_CREATED_AT_KEY, sessionCreatedAt);
  }
  return sessionCreatedAt;
}

// Get current session info for debugging
export function getSessionInfo(): { userId: string; displayName: string; sessionId: string; createdAt: string } {
  const identity = getUserIdentity();
  return {
    userId: identity.id,
    displayName: identity.displayName,
    sessionId: identity.sessionId || 'unknown',
    createdAt: identity.createdAt
  };
}
