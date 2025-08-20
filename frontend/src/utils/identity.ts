import { v4 as uuidv4 } from 'uuid';

export interface UserIdentity {
  id: string;
  displayName: string;
  createdAt: string;
}

const IDENTITY_KEY = 'fastchat_user_identity';

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
  const stored = localStorage.getItem(IDENTITY_KEY);
  
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (error) {
      console.warn('Failed to parse stored identity, creating new one');
    }
  }
  
  // Create new identity
  const newIdentity: UserIdentity = {
    id: uuidv4(),
    displayName: generateRandomName(),
    createdAt: new Date().toISOString()
  };
  
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(newIdentity));
  return newIdentity;
}

// Update display name
export function updateDisplayName(newName: string): UserIdentity {
  const identity = getUserIdentity();
  const updatedIdentity: UserIdentity = {
    ...identity,
    displayName: newName
  };
  
  localStorage.setItem(IDENTITY_KEY, JSON.stringify(updatedIdentity));
  return updatedIdentity;
}

// Clear identity (for logout)
export function clearIdentity(): void {
  localStorage.removeItem(IDENTITY_KEY);
}

// Check if identity exists
export function hasIdentity(): boolean {
  return localStorage.getItem(IDENTITY_KEY) !== null;
}
