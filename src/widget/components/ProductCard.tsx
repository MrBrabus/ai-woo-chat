'use client';

/**
 * Product card component
 */

import React from 'react';
import styles from './ProductCard.module.css';

interface Product {
  id: number;
  title: string;
  url: string;
  price: number;
  stock_status: string;
}

interface ProductCardProps {
  product: Product;
  onClick: () => void;
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  const isInStock = product.stock_status === 'instock';

  return (
    <div className={styles.productCard} onClick={onClick} role="button" tabIndex={0}>
      <div className={styles.productInfo}>
        <h4 className={styles.productTitle}>{product.title}</h4>
        <div className={styles.productMeta}>
          <span className={styles.productPrice}>${product.price.toFixed(2)}</span>
          <span className={`${styles.stockStatus} ${isInStock ? styles.inStock : styles.outOfStock}`}>
            {isInStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>
      </div>
      <div className={styles.productAction}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M7.5 15L12.5 10L7.5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
