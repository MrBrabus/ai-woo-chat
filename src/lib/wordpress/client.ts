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
  restBaseUrl?: string; // Optional: WordPress REST API base URL (e.g., '/wp-json/' or '/index.php/wp-json/')
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
  private restBasePath: string;

  constructor(config: WPAPIClientConfig) {
    this.config = config;
    // Ensure site URL doesn't end with slash
    this.baseUrl = config.siteUrl.replace(/\/$/, '');
    // Use provided restBaseUrl or default to '/wp-json/'
    this.restBasePath = config.restBaseUrl || '/wp-json/';
    // Ensure restBasePath starts with '/' and ends with '/'
    if (!this.restBasePath.startsWith('/')) {
      this.restBasePath = '/' + this.restBasePath;
    }
    if (!this.restBasePath.endsWith('/')) {
      this.restBasePath = this.restBasePath + '/';
    }
  }

  /**
   * Normalize query string to match WordPress plugin's format
   * WordPress uses sorted, RFC3986-encoded query parameters
   */
  private normalizeQueryString(queryString: string): string {
    if (!queryString) return '';
    
    const params = new URLSearchParams(queryString);
    const normalized: Array<[string, string]> = [];
    
    // Collect all params
    for (const [key, value] of params.entries()) {
      normalized.push([key, value]);
    }
    
    // Sort by key, then by value (matching WordPress behavior)
    normalized.sort((a, b) => {
      if (a[0] !== b[0]) {
        return a[0].localeCompare(b[0]);
      }
      return a[1].localeCompare(b[1]);
    });
    
    // Build query string with RFC3986 encoding (encodeURIComponent uses RFC3986)
    const queryParts = normalized.map(([key, value]) => {
      const encodedKey = encodeURIComponent(key);
      const encodedValue = value ? encodeURIComponent(value) : '';
      return encodedValue ? `${encodedKey}=${encodedValue}` : encodedKey;
    });
    
    return queryParts.join('&');
  }

  /**
   * Build canonical path for HMAC signature
   * Must match WordPress plugin's format: /ai-chat/v1/route?normalized_query
   */
  private buildCanonicalPath(path: string): string {
    // Extract route and query string
    const [route, queryString] = path.split('?');
    
    // Full route includes namespace
    const fullRoute = `/ai-chat/v1${route}`;
    
    // Normalize query string if present
    if (queryString) {
      const normalizedQuery = this.normalizeQueryString(queryString);
      return `${fullRoute}?${normalizedQuery}`;
    }
    
    return fullRoute;
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
    const bodyHash = body ? createHash('sha256').update(body).digest('hex').toLowerCase() : '';

    // Build canonical path (must match WordPress plugin's format)
    const canonicalPath = this.buildCanonicalPath(path);

    // Build canonical string (must match WordPress plugin's format exactly)
    const canonicalString = `${method.toUpperCase()}\n${canonicalPath}\n${timestamp}\n${nonce}\n${bodyHash}`;

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

    const url = `${this.baseUrl}${this.restBasePath}ai-chat/v1${path}`;
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

  /**
   * Get product availability (pickup locations, inventory per location)
   * Returns empty array if no availability data exists
   */
  async getProductAvailability(id: number, requestId?: string): Promise<{
    id: number;
    locations: Array<{
      location_id: string;
      name: string;
      address: string;
      available: boolean;
      quantity: number;
      hours?: string;
    }>;
  }> {
    try {
      return await this.makeRequest('GET', `/product/${id}/availability`, undefined, requestId);
    } catch (error) {
      // If endpoint doesn't exist or returns error, return empty locations
      // This allows the system to work without availability data
      return {
        id,
        locations: [],
      };
    }
  }

  /**
   * Discover the WordPress REST API base URL by trying common paths
   * First attempts '/wp-json/', then falls back to '/index.php/wp-json/' if 404
   * 
   * @param siteUrl - The WordPress site URL (without trailing slash)
   * @returns The discovered REST API base URL path (e.g., '/wp-json/' or '/index.php/wp-json/')
   * @throws Error if neither path works
   */
  static async discoverRestBaseUrl(siteUrl: string): Promise<string> {
    const logger = createLogger({ request_id: generateRequestId() });
    const baseUrl = siteUrl.replace(/\/$/, '');
    
    // Try standard path first
    const standardPath = '/wp-json/';
    const standardUrl = `${baseUrl}${standardPath}`;
    
    try {
      logger.info('Attempting to discover REST API base URL', {
        site_url: siteUrl,
        attempt: 'standard',
        path: standardPath,
      });
      
      const response = await fetch(standardUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok || response.status === 401 || response.status === 403) {
        // 200, 401, or 403 means the endpoint exists (401/403 are auth errors, not 404)
        logger.info('REST API base URL discovered', {
          site_url: siteUrl,
          rest_base_url: standardPath,
        });
        return standardPath;
      }
      
      if (response.status === 404) {
        // Try fallback path
        const fallbackPath = '/index.php/wp-json/';
        const fallbackUrl = `${baseUrl}${fallbackPath}`;
        
        logger.info('Standard path returned 404, trying fallback', {
          site_url: siteUrl,
          attempt: 'fallback',
          path: fallbackPath,
        });
        
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        
        if (fallbackResponse.ok || fallbackResponse.status === 401 || fallbackResponse.status === 403) {
          logger.info('REST API base URL discovered (fallback)', {
            site_url: siteUrl,
            rest_base_url: fallbackPath,
          });
          return fallbackPath;
        }
        
        if (fallbackResponse.status === 404) {
          throw new Error(`WordPress REST API not found at ${standardPath} or ${fallbackPath}`);
        }
        
        // Other error status
        throw new Error(`WordPress REST API returned status ${fallbackResponse.status} at ${fallbackPath}`);
      }
      
      // Other error status for standard path
      throw new Error(`WordPress REST API returned status ${response.status} at ${standardPath}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Timeout while discovering WordPress REST API base URL for ${siteUrl}`);
      }
      throw error;
    }
  }
}
