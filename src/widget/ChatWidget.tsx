'use client';

/**
 * Main Chat Widget Component
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { APIClient } from './api-client';
import { StorageManager } from './storage';
import type { ChatMessage, SessionData } from './types';
import { ChatBubble } from './components/ChatBubble';
import { ChatWindow } from './components/ChatWindow';

interface ChatWidgetProps {
  config: {
    saasUrl: string;
    siteId: string;
  };
}

export function ChatWidget({ config }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<SessionData | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isInitializing, setIsInitializing] = useState(true);
  const [chatConfig, setChatConfig] = useState<{
    title: string;
    welcome_message: string;
    input_placeholder: string;
    send_button_text: string;
    avatar_url: string | null;
  }>({
    title: 'AI Assistant',
    welcome_message: 'Hello! I am your AI assistant. How can I help you today?',
    input_placeholder: 'Type your message...',
    send_button_text: 'Send',
    avatar_url: null,
  });

  const apiClientRef = useRef<APIClient | null>(null);
  const storageRef = useRef<StorageManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentStreamingMessageRef = useRef<string>('');
  const currentAbortControllerRef = useRef<AbortController | null>(null);
  const [connectionState, setConnectionState] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const reconnectAttemptRef = useRef<number>(0);

  // Initialize API client and storage
  useEffect(() => {
    apiClientRef.current = new APIClient(config.saasUrl, config.siteId);
    storageRef.current = new StorageManager();

    // Bootstrap session
    const bootstrap = async () => {
      try {
        const stored = storageRef.current!.getSessionData();
        const response = await apiClientRef.current!.bootstrap(
          stored.visitorId || undefined,
          stored.conversationId || undefined
        );

        storageRef.current!.setSessionData(response.visitor_id, response.conversation_id);
        setSession({
          visitorId: response.visitor_id,
          conversationId: response.conversation_id,
          welcomeBack: response.welcome_back,
        });

        // Set chat config from bootstrap response
        if (response.chat_config) {
          setChatConfig(response.chat_config);
        }

        // Show welcome message (always show, using custom message from config)
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: response.chat_config?.welcome_message || 'Hello! I am your AI assistant. How can I help you today?',
            timestamp: new Date(),
          },
        ]);
      } catch (error) {
        console.error('Failed to bootstrap session:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    bootstrap();
  }, [config.saasUrl, config.siteId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle sending message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !session || isLoading || !apiClientRef.current) {
      return;
    }

    // Abort any existing stream
    if (currentAbortControllerRef.current) {
      currentAbortControllerRef.current.abort();
      currentAbortControllerRef.current = null;
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    currentAbortControllerRef.current = abortController;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Create placeholder for streaming assistant message
    const assistantMessageId = `assistant-${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      products: [],
    };

    setMessages((prev) => [...prev, assistantMessage]);
    currentStreamingMessageRef.current = '';

    try {
      await apiClientRef.current.sendMessage(
        session.visitorId,
        session.conversationId,
        userMessage.content,
        (sseMessage) => {
          if (sseMessage.type === 'chunk' && sseMessage.content) {
            currentStreamingMessageRef.current += sseMessage.content;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      content: currentStreamingMessageRef.current,
                      isStreaming: true,
                    }
                  : msg
              )
            );
          } else if (sseMessage.type === 'product') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                      ...msg,
                      products: [
                        ...(msg.products || []),
                        {
                          id: sseMessage.id!,
                          title: sseMessage.title!,
                          url: sseMessage.url!,
                          price: sseMessage.price!,
                          stock_status: sseMessage.stock_status!,
                        },
                      ],
                    }
                  : msg
              )
            );
          } else if (sseMessage.type === 'done') {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
          } else if (sseMessage.type === 'error') {
            throw new Error(sseMessage.message || 'Stream error');
          }
        },
        (error) => {
          // Suppress abort errors from console
          if (error.name !== 'AbortError') {
            console.error('Message error:', error);
          }
          setConnectionState('disconnected');
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: msg.content || 'Sorry, I encountered an error. Please try again.',
                    isStreaming: false,
                  }
                : msg
            )
          );
        },
        () => {
          setIsLoading(false);
          currentAbortControllerRef.current = null;
        },
        abortController.signal
      );
    } catch (error) {
      // Only show error if not aborted
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Failed to send message:', error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: msg.content || 'Sorry, I encountered an error. Please try again.',
                  isStreaming: false,
                }
              : msg
          )
        );
      }
      setIsLoading(false);
      currentAbortControllerRef.current = null;
    }
  }, [inputValue, session, isLoading]);

  // Cleanup: abort stream when widget closes or unmounts
  useEffect(() => {
    return () => {
      if (currentAbortControllerRef.current) {
        currentAbortControllerRef.current.abort();
      }
    };
  }, [isOpen]);

  // Handle browser tab visibility changes (sleep/wake)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && currentAbortControllerRef.current) {
        // Tab hidden - abort current stream
        currentAbortControllerRef.current.abort();
        currentAbortControllerRef.current = null;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Handle network online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setConnectionState('connected');
    };

    const handleOffline = () => {
      setConnectionState('disconnected');
      if (currentAbortControllerRef.current) {
        currentAbortControllerRef.current.abort();
        currentAbortControllerRef.current = null;
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle product click
  const handleProductClick = useCallback(
    (productId: number, url: string) => {
      if (!session || !apiClientRef.current) return;

      // Track click event
      apiClientRef.current.trackEvent(session.visitorId, session.conversationId, 'click', {
        product_id: productId,
        url,
      });

      // Open product page
      window.open(url, '_blank');
    },
    [session]
  );

  // Handle product view (when product card is rendered)
  const handleProductView = useCallback(
    (productId: number, url: string) => {
      if (!session || !apiClientRef.current) return;

      apiClientRef.current.trackEvent(session.visitorId, session.conversationId, 'view', {
        product_id: productId,
        url,
      });
    },
    [session]
  );

  if (isInitializing) {
    return null; // Don't render until session is initialized
  }

  return (
    <>
      <ChatBubble onClick={() => setIsOpen(true)} />
      {isOpen && (
        <ChatWindow
          messages={messages}
          inputValue={inputValue}
          isLoading={isLoading}
          onInputChange={setInputValue}
          onSendMessage={handleSendMessage}
          onClose={() => setIsOpen(false)}
          onProductClick={handleProductClick}
          onProductView={handleProductView}
          messagesEndRef={messagesEndRef}
          connectionState={connectionState}
          reconnectAttempt={reconnectAttemptRef.current}
          title={chatConfig.title}
          avatarUrl={chatConfig.avatar_url}
          inputPlaceholder={chatConfig.input_placeholder}
          sendButtonText={chatConfig.send_button_text}
        />
      )}
    </>
  );
}
