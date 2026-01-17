'use client';

/**
 * Individual message item component
 */

import React from 'react';
import type { ChatMessage } from '../types';
import styles from './MessageItem.module.css';

interface MessageItemProps {
  message: ChatMessage;
}

export function MessageItem({ message }: MessageItemProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`${styles.messageItem} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
      <div className={styles.messageContent}>
        {message.content}
        {message.isStreaming && <span className={styles.cursor}>▋</span>}
      </div>
      <div className={styles.timestamp}>
        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
