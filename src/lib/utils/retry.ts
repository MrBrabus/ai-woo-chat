/**
 * Retry utility with exponential backoff and jitter
 * 
 * Used for hardening API calls (OpenAI, WordPress, etc.)
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: boolean;
  retryableErrors?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: (error: any) => {
    // Default: retry on 429, 5xx, and network errors
    if (error?.status === 429) return true; // Rate limit
    if (error?.status >= 500) return true; // Server errors
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') return true; // Network errors
    if (error?.message?.includes('timeout')) return true;
    return false;
  },
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelayMs * Math.pow(options.backoffMultiplier, attempt);
  const delay = Math.min(exponentialDelay, options.maxDelayMs);
  
  if (options.jitter) {
    // Add random jitter: ±20% of delay
    const jitterAmount = delay * 0.2;
    const jitter = (Math.random() * 2 - 1) * jitterAmount; // -20% to +20%
    return Math.max(100, delay + jitter); // Minimum 100ms
  }
  
  return delay;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff and jitter
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (!opts.retryableErrors(error)) {
        throw error; // Not retryable, throw immediately
      }

      // If this was the last attempt, throw
      if (attempt === opts.maxRetries) {
        throw error;
      }

      // Calculate delay and wait
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Retry options for OpenAI API calls
 */
export const OPENAI_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: (error: any) => {
    // Retry on 429 (rate limit), 500-599 (server errors), and timeouts
    if (error?.status === 429) return true;
    if (error?.status >= 500 && error?.status < 600) return true;
    if (error?.message?.includes('timeout')) return true;
    if (error?.code === 'ETIMEDOUT') return true;
    return false;
  },
};

/**
 * Retry options for WordPress API calls
 */
export const WP_API_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: (error: any) => {
    // Retry on 5xx, network errors, and timeouts
    if (error?.status >= 500 && error?.status < 600) return true;
    if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT') return true;
    if (error?.message?.includes('timeout') || error?.message?.includes('network')) return true;
    return false;
  },
};
