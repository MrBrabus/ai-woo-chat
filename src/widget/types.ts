/**
 * Widget types and interfaces
 */

export interface WidgetConfig {
  saasUrl: string;
  siteId: string;
  containerId: string;
}

export interface BootstrapResponse {
  visitor_id: string;
  conversation_id: string;
  welcome_back: boolean;
  session?: {
    first_seen_at: string;
    last_seen_at: string;
    conversation_count: number;
  };
}

export interface SSEMessage {
  type: 'chunk' | 'product' | 'done' | 'error';
  content?: string;
  id?: number;
  title?: string;
  url?: string;
  price?: number;
  stock_status?: string;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: Array<{
    id: number;
    title: string;
    url: string;
    price: number;
    stock_status: string;
  }>;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface SessionData {
  visitorId: string;
  conversationId: string;
  welcomeBack: boolean;
}
