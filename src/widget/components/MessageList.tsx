'use client';

/**
 * Message list component
 */

import React, { useEffect, useRef } from 'react';
import type { ChatMessage } from '../types';
import { MessageItem } from './MessageItem';
import { ProductCard } from './ProductCard';
import styles from './MessageList.module.css';

interface MessageListProps {
  messages: ChatMessage[];
  onProductClick: (productId: number, url: string) => void;
  onProductView: (productId: number, url: string) => void;
}

export function MessageList({ messages, onProductClick, onProductView }: MessageListProps) {
  const productViewRefs = useRef<Map<number, boolean>>(new Map());

  // Track product views when they enter viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const productId = parseInt(entry.target.getAttribute('data-product-id') || '0', 10);
            const url = entry.target.getAttribute('data-product-url') || '';
            if (productId && url && !productViewRefs.current.get(productId)) {
              productViewRefs.current.set(productId, true);
              onProductView(productId, url);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    const productElements = document.querySelectorAll('[data-product-id]');
    productElements.forEach((el) => observer.observe(el));

    return () => {
      productElements.forEach((el) => observer.unobserve(el));
      observer.disconnect();
    };
  }, [messages, onProductView]);

  if (messages.length === 0) {
    return (
      <div className={styles.emptyState}>
        <p>How can I help you today?</p>
      </div>
    );
  }

  return (
    <div className={styles.messageList}>
      {messages.map((message) => (
        <div key={message.id} className={styles.messageWrapper}>
          <MessageItem message={message} />
          {message.products && message.products.length > 0 && (
            <div className={styles.productsContainer}>
              {message.products.map((product) => (
                <div
                  key={product.id}
                  data-product-id={product.id}
                  data-product-url={product.url}
                >
                  <ProductCard
                    product={product}
                    onClick={() => onProductClick(product.id, product.url)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
