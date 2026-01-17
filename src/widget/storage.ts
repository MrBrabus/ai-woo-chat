/**
 * Storage management for visitor/conversation IDs
 * 
 * Uses localStorage with fallback to sessionStorage
 * Cookie support can be added for production
 */

const STORAGE_PREFIX = 'ai_woo_chat_';
const VISITOR_ID_KEY = `${STORAGE_PREFIX}visitor_id`;
const CONVERSATION_ID_KEY = `${STORAGE_PREFIX}conversation_id`;
const VISITOR_ID_EXPIRY_KEY = `${STORAGE_PREFIX}visitor_id_expiry`;
const CONVERSATION_ID_EXPIRY_KEY = `${STORAGE_PREFIX}conversation_id_expiry`;

// TTL: 90 days for visitor ID, 30 days for conversation ID
const VISITOR_ID_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const CONVERSATION_ID_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export class StorageManager {
  private storage: Storage;

  constructor() {
    // Prefer localStorage, fallback to sessionStorage
    try {
      if (typeof localStorage !== 'undefined') {
        this.storage = localStorage;
      } else if (typeof sessionStorage !== 'undefined') {
        this.storage = sessionStorage;
      } else {
        // Fallback to in-memory storage
        this.storage = this.createMemoryStorage();
      }
    } catch (e) {
      // localStorage might be disabled (private browsing, etc.)
      this.storage = this.createMemoryStorage();
    }
  }

  private createMemoryStorage(): Storage {
    const data: Record<string, string> = {};
    return {
      getItem: (key: string) => data[key] || null,
      setItem: (key: string, value: string) => { data[key] = value; },
      removeItem: (key: string) => { delete data[key]; },
      clear: () => { Object.keys(data).forEach(k => delete data[k]); },
      key: (index: number) => Object.keys(data)[index] || null,
      get length() { return Object.keys(data).length; },
    } as Storage;
  }

  /**
   * Check if a stored value has expired
   */
  private isExpired(expiryKey: string): boolean {
    try {
      const expiry = this.storage.getItem(expiryKey);
      if (!expiry) return true;
      return Date.now() > parseInt(expiry, 10);
    } catch {
      return true;
    }
  }

  /**
   * Get visitor ID from storage (with expiry check)
   */
  getVisitorId(): string | null {
    try {
      if (this.isExpired(VISITOR_ID_EXPIRY_KEY)) {
        this.removeItem(VISITOR_ID_KEY);
        this.removeItem(VISITOR_ID_EXPIRY_KEY);
        return null;
      }
      return this.storage.getItem(VISITOR_ID_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Set visitor ID in storage (with expiry)
   */
  setVisitorId(visitorId: string): void {
    try {
      const expiry = Date.now() + VISITOR_ID_TTL_MS;
      this.storage.setItem(VISITOR_ID_KEY, visitorId);
      this.storage.setItem(VISITOR_ID_EXPIRY_KEY, expiry.toString());
    } catch (e) {
      console.warn('Failed to save visitor ID:', e);
    }
  }

  /**
   * Get conversation ID from storage (with expiry check)
   */
  getConversationId(): string | null {
    try {
      if (this.isExpired(CONVERSATION_ID_EXPIRY_KEY)) {
        this.removeItem(CONVERSATION_ID_KEY);
        this.removeItem(CONVERSATION_ID_EXPIRY_KEY);
        return null;
      }
      return this.storage.getItem(CONVERSATION_ID_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Set conversation ID in storage (with expiry)
   */
  setConversationId(conversationId: string): void {
    try {
      const expiry = Date.now() + CONVERSATION_ID_TTL_MS;
      this.storage.setItem(CONVERSATION_ID_KEY, conversationId);
      this.storage.setItem(CONVERSATION_ID_EXPIRY_KEY, expiry.toString());
    } catch (e) {
      console.warn('Failed to save conversation ID:', e);
    }
  }

  /**
   * Remove item helper
   */
  private removeItem(key: string): void {
    try {
      this.storage.removeItem(key);
    } catch {
      // Ignore
    }
  }

  /**
   * Clear all stored data
   */
  clear(): void {
    try {
      this.removeItem(VISITOR_ID_KEY);
      this.removeItem(VISITOR_ID_EXPIRY_KEY);
      this.removeItem(CONVERSATION_ID_KEY);
      this.removeItem(CONVERSATION_ID_EXPIRY_KEY);
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
  }

  /**
   * Get all session data
   */
  getSessionData(): { visitorId: string | null; conversationId: string | null } {
    return {
      visitorId: this.getVisitorId(),
      conversationId: this.getConversationId(),
    };
  }

  /**
   * Set all session data
   */
  setSessionData(visitorId: string, conversationId: string): void {
    this.setVisitorId(visitorId);
    this.setConversationId(conversationId);
  }
}
