/**
 * API client for chat endpoints
 * 
 * Hardened with SSE reconnect logic and exponential backoff
 */

import type { BootstrapResponse, SSEMessage } from './types';

export class APIClient {
  private saasUrl: string;
  private siteId: string;
  private origin: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private baseReconnectDelay: number = 1000; // 1 second

  constructor(saasUrl: string, siteId: string) {
    this.saasUrl = saasUrl.replace(/\/$/, ''); // Remove trailing slash
    this.siteId = siteId;
    this.origin = window.location.origin;
  }

  /**
   * Calculate reconnect delay with exponential backoff and jitter
   */
  private calculateReconnectDelay(attempt: number): number {
    const exponentialDelay = this.baseReconnectDelay * Math.pow(2, attempt);
    const maxDelay = 30000; // 30 seconds max
    const delay = Math.min(exponentialDelay, maxDelay);
    // Add jitter: ±20%
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.max(100, delay + jitter);
  }

  /**
   * Bootstrap chat session
   */
  async bootstrap(visitorId?: string, conversationId?: string): Promise<BootstrapResponse> {
    const response = await fetch(`${this.saasUrl}/api/chat/bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: this.origin,
      },
      body: JSON.stringify({
        site_id: this.siteId,
        visitor_id: visitorId || null,
        conversation_id: conversationId || null,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(error.error?.message || `Bootstrap failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Send chat message and stream response via SSE
   * Hardened with reconnect logic and exponential backoff
   */
  async sendMessage(
    visitorId: string,
    conversationId: string,
    message: string,
    onMessage: (msg: SSEMessage) => void,
    onError?: (error: Error) => void,
    onComplete?: () => void,
    abortSignal?: AbortSignal,
    onReconnecting?: (attempt: number) => void
  ): Promise<void> {
    let lastMessageId: string | null = null; // Track last message ID to prevent duplicates
    let reconnectAttempt = 0;

    const attemptConnection = async (): Promise<void> => {
      // Check abort signal
      if (abortSignal?.aborted) {
        return;
      }

      try {
        const response = await fetch(`${this.saasUrl}/api/chat/message`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Origin: this.origin,
          },
          body: JSON.stringify({
            site_id: this.siteId,
            visitor_id: visitorId,
            conversation_id: conversationId,
            message,
          }),
          signal: abortSignal,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
          throw new Error(error.error?.message || `Message failed: ${response.status}`);
        }

        // Reset reconnect attempts on successful connection
        reconnectAttempt = 0;
        this.reconnectAttempts = 0;

        // Parse SSE stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No response body');
        }

        let buffer = '';

        try {
          while (true) {
            // Check if aborted
            if (abortSignal?.aborted) {
              reader.cancel();
              return;
            }

            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              // Skip empty lines
              if (!line.trim()) continue;

              // Parse SSE data frames (format: "data: {...}")
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  // Prevent duplicate messages on reconnect
                  const messageId = data.id || `${data.type}-${Date.now()}`;
                  if (lastMessageId && messageId === lastMessageId && data.type === 'chunk') {
                    continue; // Skip duplicate chunk
                  }
                  lastMessageId = messageId;

                  onMessage(data);

                  if (data.type === 'done') {
                    onComplete?.();
                    return;
                  }

                  if (data.type === 'error') {
                    throw new Error(data.message || 'Stream error');
                  }
                } catch (e) {
                  // Ignore parse errors for malformed JSON
                  if (line.trim() && !line.startsWith(':')) {
                    console.warn('Failed to parse SSE data:', line, e);
                  }
                }
              } else if (line.startsWith('id: ')) {
                // Track SSE event ID for duplicate prevention
                lastMessageId = line.slice(4).trim();
              } else if (line.startsWith(':')) {
                // SSE comment (e.g., heartbeat: ": heartbeat")
                // Ignore comments
              } else if (line.startsWith('event: ')) {
                // SSE event type (optional)
                // Ignore for now
              }
            }
          }

          onComplete?.();
        } catch (error) {
          // Cancel reader on error
          try {
            reader.cancel();
          } catch {
            // Ignore cancel errors
          }
          throw error;
        }
      } catch (error) {
        // Don't throw abort errors
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        // Check if we should retry
        const isRetryable = error instanceof Error && (
          error.message.includes('network') ||
          error.message.includes('timeout') ||
          error.message.includes('fetch') ||
          !navigator.onLine
        );

        if (isRetryable && reconnectAttempt < this.maxReconnectAttempts && !abortSignal?.aborted) {
          reconnectAttempt++;
          this.reconnectAttempts = reconnectAttempt;
          const delay = this.calculateReconnectDelay(reconnectAttempt - 1);
          
          onReconnecting?.(reconnectAttempt);
          
          await new Promise((resolve) => setTimeout(resolve, delay));
          return attemptConnection(); // Retry
        }

        // Max retries reached or non-retryable error
        const err = error instanceof Error ? error : new Error('Unknown error');
        onError?.(err);
        throw err;
      }
    };

    return attemptConnection();
  }

  /**
   * Track user event
   */
  async trackEvent(
    visitorId: string,
    conversationId: string | null,
    type: 'view' | 'click' | 'add_to_cart',
    payload: Record<string, any>
  ): Promise<void> {
    try {
      const response = await fetch(`${this.saasUrl}/api/chat/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: this.origin,
        },
        body: JSON.stringify({
          site_id: this.siteId,
          visitor_id: visitorId,
          conversation_id: conversationId,
          type,
          payload,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        console.warn('Failed to track event:', error.error?.message || response.status);
      }
    } catch (error) {
      console.warn('Failed to track event:', error);
      // Don't throw - event tracking failures shouldn't break the widget
    }
  }
}
