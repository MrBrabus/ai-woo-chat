/**
 * OpenAI embeddings generation with content hashing
 * 
 * Generates embeddings using OpenAI API and tracks content hashes
 * for deduplication and versioning
 * 
 * Hardened with retry logic, batching, and content-hash deduplication
 */

import OpenAI from 'openai';
import { createHash } from 'crypto';
import { withRetry, OPENAI_RETRY_OPTIONS } from '@/lib/utils/retry';
import { createLogger, logOpenAIFailure } from '@/lib/utils/logger';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30000, // 30 second timeout
});

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  contentHash: string;
  tokens: number;
}

export interface ChunkMetadata {
  chunk_index: number;
  chunk_text: string;
  chunk_hash: string;
  start_char: number;
  end_char: number;
}

/**
 * Generate content hash for deduplication
 */
export function generateContentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Chunk text into smaller pieces for embedding
 * Uses simple character-based chunking with overlap
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): string[] {
  if (text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap; // Overlap for context preservation
  }

  return chunks;
}

/**
 * Generate embedding for a single text chunk (with retry)
 */
export async function generateEmbedding(
  text: string,
  model: string = 'text-embedding-3-small',
  requestId?: string
): Promise<EmbeddingResult> {
  const logger = createLogger({ request_id: requestId });
  const startTime = Date.now();

  try {
    const response = await withRetry(
      async () => {
        return await openai.embeddings.create({
          model,
          input: text,
        });
      },
      {
        ...OPENAI_RETRY_OPTIONS,
        retryableErrors: (error: any) => {
          // Retry on 429, 5xx, and timeouts
          if (error?.status === 429) return true;
          if (error?.status >= 500 && error?.status < 600) return true;
          if (error?.message?.includes('timeout')) return true;
          if (error?.code === 'ETIMEDOUT') return true;
          return false;
        },
      }
    );

    const embedding = response.data[0].embedding;
    const contentHash = generateContentHash(text);
    const tokens = response.usage.total_tokens;
    const latency = Date.now() - startTime;

    logger.info('Embedding generated', {
      model,
      tokens,
      latency_ms: latency,
    });

    return {
      embedding,
      model,
      contentHash,
      tokens,
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    logOpenAIFailure(logger, error instanceof Error ? error : new Error('Unknown error'), {
      model,
      latency_ms: latency,
    });
    throw new Error(
      `Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Generate embeddings for text with chunking and batching
 * Returns embeddings with metadata for each chunk
 * 
 * Hardened with:
 * - Batching (multiple chunks per OpenAI request)
 * - Content-hash deduplication skip
 * - Retry logic
 */
export async function generateEmbeddingsWithChunking(
  text: string,
  model: string = 'text-embedding-3-small',
  chunkSize: number = 1000,
  overlap: number = 200,
  requestId?: string,
  existingHashes?: Set<string> // For content-hash deduplication
): Promise<{
  embeddings: Array<{
    embedding: number[];
    chunkMetadata: ChunkMetadata;
  }>;
  totalTokens: number;
  model: string;
  skipped: number; // Number of chunks skipped due to deduplication
}> {
  const logger = createLogger({ request_id: requestId });
  const chunks = chunkText(text, chunkSize, overlap);
  const embeddings: Array<{
    embedding: number[];
    chunkMetadata: ChunkMetadata;
  }> = [];
  let totalTokens = 0;
  let skipped = 0;

  // Pre-compute hashes for deduplication
  const chunkHashes = chunks.map((chunk) => generateContentHash(chunk));
  const chunksToProcess: Array<{ index: number; chunk: string; hash: string }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const hash = chunkHashes[i];
    // Skip if hash already exists (deduplication)
    if (existingHashes && existingHashes.has(hash)) {
      skipped++;
      logger.debug('Skipping duplicate chunk', { chunk_index: i, chunk_hash: hash });
      continue;
    }
    chunksToProcess.push({ index: i, chunk: chunks[i], hash });
  }

  // Batch embeddings requests (OpenAI supports up to 2048 inputs per request)
  // We'll batch in groups of 100 to stay well under limits
  const batchSize = 100;

  for (let i = 0; i < chunksToProcess.length; i += batchSize) {
    const batch = chunksToProcess.slice(i, i + batchSize);
    const batchTexts = batch.map((item) => item.chunk);

    try {
      // Generate embeddings for batch
      const response = await withRetry(
        async () => {
          return await openai.embeddings.create({
            model,
            input: batchTexts,
          });
        },
        {
          ...OPENAI_RETRY_OPTIONS,
          retryableErrors: (error: any) => {
            if (error?.status === 429) return true;
            if (error?.status >= 500 && error?.status < 600) return true;
            if (error?.message?.includes('timeout')) return true;
            return false;
          },
        }
      );

      // Process batch results
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const embedding = response.data[j].embedding;
        const tokens = response.usage.total_tokens / batch.length; // Approximate per chunk

        totalTokens += Math.ceil(tokens);

        // Calculate character positions
        const startChar = item.index === 0 ? 0 : item.index * (chunkSize - overlap);
        const endChar = startChar + item.chunk.length;

        embeddings.push({
          embedding,
          chunkMetadata: {
            chunk_index: item.index,
            chunk_text: item.chunk,
            chunk_hash: item.hash,
            start_char: startChar,
            end_char: endChar,
          },
        });
      }

      logger.info('Batch embeddings generated', {
        batch_size: batch.length,
        total_chunks: chunksToProcess.length,
        processed: Math.min(i + batchSize, chunksToProcess.length),
      });
    } catch (error) {
      logOpenAIFailure(
        logger,
        error instanceof Error ? error : new Error('Unknown error'),
        {
          batch_start: i,
          batch_size: batch.length,
        }
      );
      throw error;
    }
  }

  // Sort embeddings by chunk_index to maintain order
  embeddings.sort((a, b) => a.chunkMetadata.chunk_index - b.chunkMetadata.chunk_index);

  return {
    embeddings,
    totalTokens,
    model,
    skipped,
  };
}

/**
 * Build text content from product card for embedding
 */
export function buildProductText(product: {
  title: string;
  summary: string;
  categories?: string[];
  tags?: string[];
  brand?: string;
  attributes?: Record<string, string[]>;
  sku?: string;
  variation_attributes?: string[];
  price_range?: {
    min: number;
    max: number;
    currency: string;
  };
}): string {
  const parts: string[] = [];

  parts.push(`Product: ${product.title}`);

  if (product.sku) {
    parts.push(`SKU: ${product.sku}`);
  }

  if (product.brand) {
    parts.push(`Brand: ${product.brand}`);
  }

  parts.push(`Description: ${product.summary}`);

  if (product.categories && product.categories.length > 0) {
    parts.push(`Categories: ${product.categories.join(', ')}`);
  }

  if (product.tags && product.tags.length > 0) {
    parts.push(`Tags: ${product.tags.join(', ')}`);
  }

  if (product.attributes) {
    const attrStrings = Object.entries(product.attributes).map(
      ([key, values]) => `${key}: ${values.join(', ')}`
    );
    if (attrStrings.length > 0) {
      parts.push(`Attributes: ${attrStrings.join('; ')}`);
    }
  }

  // Add variation attributes (available variations like color, size)
  if (product.variation_attributes && product.variation_attributes.length > 0) {
    parts.push(`Available Variations: ${product.variation_attributes.join(', ')}`);
  }

  // Add price range if available
  if (product.price_range) {
    const currencySymbol = product.price_range.currency === 'USD' ? '$' : product.price_range.currency;
    if (product.price_range.min === product.price_range.max) {
      parts.push(`Price: ${currencySymbol}${product.price_range.min}`);
    } else {
      parts.push(`Price Range: ${currencySymbol}${product.price_range.min} - ${currencySymbol}${product.price_range.max}`);
    }
  }

  return parts.join('\n');
}

/**
 * Build text content from page for embedding
 */
export function buildPageText(page: {
  title: string;
  content: string;
  type?: string;
}): string {
  return `Page: ${page.title}\n\n${page.content}`;
}
