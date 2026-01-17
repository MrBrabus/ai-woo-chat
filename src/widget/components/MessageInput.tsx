'use client';

/**
 * Message input component
 */

import React, { KeyboardEvent } from 'react';
import styles from './MessageInput.module.css';

interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export function MessageInput({ value, onChange, onSend, disabled }: MessageInputProps) {
  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className={styles.inputContainer}>
      <textarea
        className={styles.input}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder="Type your message..."
        disabled={disabled}
        rows={1}
      />
      <button
        className={styles.sendButton}
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        type="button"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M18 2L9 11M18 2L12 18L9 11M18 2L2 8L9 11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
