'use client';

/**
 * Chat bubble button component
 * Modern design with smooth animations
 */

import React from 'react';
import styles from './ChatBubble.module.css';

interface ChatBubbleProps {
  onClick: () => void;
  primaryColor?: string;
  secondaryColor?: string;
  useGradient?: boolean;
  position?: 'bottom-right' | 'center-right';
}

export function ChatBubble({
  onClick,
  primaryColor = '#667eea',
  secondaryColor = '#764ba2',
  useGradient = true,
  position = 'bottom-right',
}: ChatBubbleProps) {
  const backgroundStyle = useGradient
    ? {
        background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
      }
    : {
        background: primaryColor,
      };

  const positionClass = position === 'center-right' ? styles.centerRight : styles.bottomRight;

  return (
    <button
      className={`${styles.chatBubble} ${positionClass}`}
      onClick={onClick}
      aria-label="Open chat"
      type="button"
      style={backgroundStyle}
    >
      <div className={styles.bubbleContent}>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={styles.icon}
        >
          <path
            d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z"
            fill="currentColor"
          />
        </svg>
        <div className={styles.pulseRing} />
        <div className={styles.pulseRing2} />
      </div>
    </button>
  );
}
