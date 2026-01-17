/**
 * WordPress API client with HMAC signing
 * 
 * Makes authenticated requests to WordPress plugin REST endpoints
 * Supports batch operations for efficient data retrieval
 * 
 * Hardened with retry logic and timeout enforcement
 */

import { createHash, createHmac } from 'crypto';
import { randomUUID } from 'crypto';
import { withRetry, WP_API_RETRY_OPTIONS } from '@/lib/utils/retry';
import { createLogger, logWPAPIFailure, generateRequestId } from '@/lib/utils/logger';

export interface WPAPIClientConfig {
  siteUrl: string;
  siteId: string;
  secret: string;
}

export interface ProductCard {
  id: number;
  title: string;
  url: string;
  sku?: string;
  summary: string;
  attributes?: Record<string, string[]>;
  categories?: string[];
  tags?: string[];
  brand?: string;
  price_range?: {
    min: number;
    max: number;
    currency: string;
  };
  stock_status: string;
  shipping_class?: string;
  images?: string[];
  variation_attributes?: string[];
  updated_at: string;
}

export interface SiteContext {
  site_url: string;
  site_name: string;
  contact?: {
    email?: string;
    phone?: string;
  };
  working_hours?: string;
  support_emails?: string[];
  policies?: {
    shipping?: string;
    returns?: string;
    terms?: string;
    privacy?: string;
  };
  shop_info?: {
    currency?: string;
    currency_symbol?: string;
    timezone?: string;
  };
}

export class WPAPIClient {
  private config: WPAPIClientConfig;
  private baseUrl: string;

  constructor(config: WPAPIClientConfig) {
    this.config = config;
    // Ensure site URL doesn't end with slash
    this.baseUrl = config.siteUrl.replace(/\/$/, '');
  }

  /**
   * Generate HMAC headers for a request
   */
  private generateHMACHeaders(
    method: string,
    path: string,
    body: string = ''
  ): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomUUID();
    const bodyHash = body ? createHash('sha256').update(body).digest('hex') : '';

    // Build canonical string
    const canonicalString = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;

    // Compute signature
    const signature = createHmac('sha256', this.config.secret)
      .update(canonicalString)
      .digest('base64');

    return {
      'X-AI-Site': this.config.siteId,
      'X-AI-Ts': timestamp,
      'X-AI-Nonce': nonce,
      'X-AI-Sign': signature,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make a signed request to WordPress API (with retry and timeout)
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    body?: any,
    requestId?: string
  ): Promise<T> {
    const logger = createLogger({
      request_id: requestId || generateRequestId(),
      site_id: this.config.siteId,
    });

    const url = `${this.baseUrl}/wp-json/ai-chat/v1${path}`;
    const bodyString = body ? JSON.stringify(body) : '';
    const headers = this.generateHMACHeaders(method, path, bodyString);

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    try {
      const response = await withRetry(
        async () => {
          const res = await fetch(url, {
            method,
            headers,
            body: bodyString || undefined,
            signal: controller.signal,
          });

          if (!res.ok) {
            const error = await res.json().catch(() => ({
              error: { code: 'HTTP_ERROR', message: `HTTP ${res.status}`, status: res.status },
            }));
            const err = new Error(
              error.error?.message || `WordPress API error: ${res.status}`
            ) as any;
            err.status = res.status;
            throw err;
          }

          return res;
        },
        WP_API_RETRY_OPTIONS
      );

      clearTimeout(timeoutId);
      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      logWPAPIFailure(
        logger,
        error instanceof Error ? error : new Error('Unknown error'),
        {
          method,
          path,
        }
      );
      throw error;
    }
  }

  /**
   * Get site context information
   */
  async getSiteContext(requestId?: string): Promise<SiteContext> {
    return this.makeRequest<SiteContext>('GET', '/site/context', undefined, requestId);
  }

  /**
   * Get list of changed products (paginated)
   */
  async getChangedProducts(
    updatedAfter: string,
    page: number = 1,
    perPage: number = 50,
    requestId?: string
  ): Promise<{
    products: Array<{ id: number; updated_at: string }>;
    pagination: {
      page: number;
      per_page: number;
      total: number;
      total_pages: number;
    };
  }> {
    const query = new URLSearchParams({
      updated_after: updatedAfter,
      page: page.toString(),
      per_page: Math.min(perPage, 100).toString(),
    });

    return this.makeRequest('GET', `/products/changed?${query}`, undefined, requestId);
  }

  /**
   * Get product card data for a single product
   */
  async getProduct(id: number, requestId?: string): Promise<ProductCard> {
    return this.makeRequest<ProductCard>('GET', `/product/${id}`, undefined, requestId);
  }

  /**
   * Get product card data for multiple products (batch)
   * Returns only products that exist (missing products are omitted)
   */
  async getProductsBatch(productIds: number[], requestId?: string): Promise<{
    products: ProductCard[];
  }> {
    if (productIds.length === 0) {
      return { products: [] };
    }

    // Batch endpoint supports up to 100 products per request
    const batchSize = 100;
    const batches: ProductCard[] = [];

    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const result = await this.makeRequest<{ products: ProductCard[] }>(
        'POST',
        '/products/batch',
        { product_ids: batch },
        requestId
      );
      batches.push(...result.products);
    }

    return { products: batches };
  }

  /**
   * Get live product data (current price, stock, variations)
   * Hardened with timeout enforcement
   */
  async getProductLive(id: number, requestId?: string): Promise<{
    id: number;
    price: number;
    sale_price: number | null;
    regular_price: number;
    stock_status: string;
    stock_quantity: number | null;
    variations: Array<{
      id: number;
      attributes: Record<string, string>;
      price: number;
      stock_status: string;
      stock_quantity: number | null;
      purchasable: boolean;
    }>;
    purchasable: boolean;
    updated_at: string;
  }> {
    return this.makeRequest('GET', `/product/${id}/live`, undefined, requestId);
  }

  /**
   * Get page content (for page.updated events)
   * Note: This endpoint may need to be implemented in WordPress plugin
   * For now, we'll use a placeholder structure
   * 
   * If the endpoint doesn't exist yet, this will throw an error
   * which should be handled by the ingestion service
   */
  async getPage(id: number, requestId?: string): Promise<{
    id: number;
    title: string;
    url: string;
    content: string;
    type: 'page' | 'post' | 'policy';
    updated_at: string;
  }> {
    // Try to fetch from WordPress API
    // If endpoint doesn't exist, this will throw and be handled upstream
    return this.makeRequest('GET', `/page/${id}`, undefined, requestId);
  }
}
