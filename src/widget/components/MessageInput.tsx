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
  placeholder?: string;
  sendButtonText?: string;
}

export function MessageInput({ value, onChange, onSend, disabled, placeholder = 'Type your message...', sendButtonText = 'Send' }: MessageInputProps) {
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
        placeholder={placeholder}
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
        {sendButtonText}
      </button>
    </div>
  );
}
