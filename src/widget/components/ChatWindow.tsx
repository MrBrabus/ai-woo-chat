'use client';

/**
 * Chat window component
 */

import React, { RefObject } from 'react';
import type { ChatMessage } from '../types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import styles from './ChatWindow.module.css';

interface ChatWindowProps {
  messages: ChatMessage[];
  inputValue: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSendMessage: () => void;
  onClose: () => void;
  onProductClick: (productId: number, url: string) => void;
  onProductView: (productId: number, url: string) => void;
  messagesEndRef: RefObject<HTMLDivElement>;
  connectionState?: 'connected' | 'reconnecting' | 'disconnected';
  reconnectAttempt?: number;
}

export function ChatWindow({
  messages,
  inputValue,
  isLoading,
  onInputChange,
  onSendMessage,
  onClose,
  onProductClick,
  onProductView,
  messagesEndRef,
  connectionState = 'connected',
  reconnectAttempt = 0,
}: ChatWindowProps) {
  return (
    <div className={styles.chatWindow}>
      <div className={styles.header}>
        <h3 className={styles.title}>AI Assistant</h3>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close chat" type="button">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      {connectionState === 'reconnecting' && (
        <div className={styles.connectionStatus}>
          <span>Reconnecting... (attempt {reconnectAttempt})</span>
        </div>
      )}
      {connectionState === 'disconnected' && (
        <div className={styles.connectionStatus}>
          <span>Connection lost. Please try again.</span>
        </div>
      )}
      <div className={styles.messagesContainer}>
        <MessageList
          messages={messages}
          onProductClick={onProductClick}
          onProductView={onProductView}
        />
        <div ref={messagesEndRef} />
      </div>
      <MessageInput
        value={inputValue}
        onChange={onInputChange}
        onSend={onSendMessage}
        disabled={isLoading || connectionState === 'reconnecting' || connectionState === 'disconnected'}
      />
    </div>
  );
}
