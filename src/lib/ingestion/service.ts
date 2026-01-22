/**
 * Ingestion service
 * 
 * Orchestrates the ingestion pipeline:
 * 1. Fetch content from WordPress
 * 2. Generate embeddings with OpenAI
 * 3. Store in pgvector with chunking metadata
 * 
 * Hardened with retry logic, content-hash deduplication, and improved error handling
 */

import { createAdminClient } from '@/lib/supabase/server';
import { WPAPIClient, ProductCard, SiteContext } from '@/lib/wordpress/client';
import {
  generateEmbeddingsWithChunking,
  buildProductText,
  buildPageText,
  generateContentHash,
} from '@/lib/embeddings/openai';
import { logEmbeddingUsage } from '@/lib/embedding-usage';
import { withRetry, WP_API_RETRY_OPTIONS } from '@/lib/utils/retry';
import { createLogger, generateRequestId, logWPAPIFailure } from '@/lib/utils/logger';
import type { ChunkMetadata } from '@/lib/embeddings/openai';

const supabaseAdmin = createAdminClient();

export interface IngestionContext {
  siteId: string;
  tenantId: string;
  siteUrl: string;
  siteSecret: string;
}

export interface IngestionResult {
  success: boolean;
  embeddingsCreated: number;
  tokensUsed: number;
  error?: string;
}

/**
 * Ingest a single product
 */
export async function ingestProduct(
  context: IngestionContext,
  productId: string
): Promise<IngestionResult> {
  const requestId = generateRequestId();
  const logger = createLogger({
    request_id: requestId,
    site_id: context.siteId,
    tenant_id: context.tenantId,
    entity_type: 'product',
    entity_id: productId,
  });

  // Fetch rest_base_url from database
  const { data: siteData } = await supabaseAdmin
    .from('sites')
    .select('rest_base_url')
    .eq('id', context.siteId)
    .single();

  const wpClient = new WPAPIClient({
    siteUrl: context.siteUrl,
    siteId: context.siteId,
    secret: context.siteSecret,
    restBaseUrl: siteData?.rest_base_url || undefined,
  });

  try {
    // Fetch product data with retry
    const product = await withRetry(
      async () => {
        return await wpClient.getProduct(parseInt(productId, 10), requestId);
      },
      WP_API_RETRY_OPTIONS
    ).catch((error) => {
      logWPAPIFailure(logger, error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'getProduct',
        product_id: productId,
      });
      throw error;
    });

    // Build text content
    const text = buildProductText(product);
    const fullContentHash = generateContentHash(text);

    // Check for existing embeddings with same content hash (deduplication)
    const { data: existingEmbeddings } = await supabaseAdmin
      .from('embeddings')
      .select('metadata')
      .eq('site_id', context.siteId)
      .eq('entity_type', 'product')
      .eq('entity_id', productId)
      .eq('metadata->>full_content_hash', fullContentHash)
      .limit(1);

    if (existingEmbeddings && existingEmbeddings.length > 0) {
      logger.info('Skipping ingestion - content unchanged', {
        product_id: productId,
        content_hash: fullContentHash,
      });
      return {
        success: true,
        embeddingsCreated: 0,
        tokensUsed: 0,
      };
    }

    // Get existing chunk hashes for deduplication
    const { data: existingChunks } = await supabaseAdmin
      .from('embeddings')
      .select('metadata->>chunk_hash')
      .eq('site_id', context.siteId)
      .eq('entity_type', 'product')
      .eq('entity_id', productId);

    const existingHashes = new Set<string>();
    if (existingChunks) {
      for (const chunk of existingChunks) {
        const hash = chunk['chunk_hash'];
        if (hash) existingHashes.add(hash);
      }
    }

    // Generate embeddings with chunking and batching
    const { embeddings, totalTokens, model, skipped } =
      await generateEmbeddingsWithChunking(text, 'text-embedding-3-small', 1000, 200, requestId, existingHashes);

    // Store embeddings in database
    let embeddingsCreated = 0;

    for (const { embedding, chunkMetadata } of embeddings) {
      // Get current version for this entity
      const { data: existing } = await supabaseAdmin
        .from('embeddings')
        .select('version')
        .eq('site_id', context.siteId)
        .eq('entity_type', 'product')
        .eq('entity_id', productId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = existing ? existing.version + 1 : 1;

      // Store embedding with chunking metadata
      // pgvector expects array format, Supabase will convert it
      const { error: insertError } = await supabaseAdmin
        .from('embeddings')
        .insert({
          site_id: context.siteId,
          tenant_id: context.tenantId,
          entity_type: 'product',
          entity_id: productId,
          content_text: chunkMetadata.chunk_text,
          embedding: embedding, // pgvector accepts array directly
          model,
          version: nextVersion,
          metadata: {
            chunk_index: chunkMetadata.chunk_index,
            chunk_hash: chunkMetadata.chunk_hash,
            start_char: chunkMetadata.start_char,
            end_char: chunkMetadata.end_char,
            product_id: product.id,
            product_title: product.title,
            product_url: product.url,
            full_content_hash: fullContentHash, // Use full content hash for deduplication
          } as any,
        });

      if (insertError) {
        console.error('Error storing embedding:', insertError);
        throw new Error(`Failed to store embedding: ${insertError.message}`);
      }

      embeddingsCreated++;
    }

    logger.info('Product ingestion completed', {
      embeddings_created: embeddingsCreated,
      tokens_used: totalTokens,
      chunks_skipped: skipped,
    });

    // Log embedding usage
    await logEmbeddingUsage({
      site_id: context.siteId,
      tenant_id: context.tenantId,
      model,
      prompt_tokens: totalTokens,
      completion_tokens: 0,
      total_tokens: totalTokens,
      latency_ms: 0, // Will be calculated by the logging function
      success: true,
    });

    return {
      success: true,
      embeddingsCreated,
      tokensUsed: totalTokens,
    };
  } catch (error) {
    logger.error('Product ingestion failed', error instanceof Error ? error : new Error('Unknown error'));

    // Log failed embedding usage
    await logEmbeddingUsage({
      site_id: context.siteId,
      tenant_id: context.tenantId,
      model: 'text-embedding-3-small',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      latency_ms: 0,
      success: false,
      error_code: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });

    return {
      success: false,
      embeddingsCreated: 0,
      tokensUsed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Ingest a page
 */
export async function ingestPage(
  context: IngestionContext,
  pageId: string
): Promise<IngestionResult> {
  const requestId = generateRequestId();
  const logger = createLogger({
    request_id: requestId,
    site_id: context.siteId,
    tenant_id: context.tenantId,
    entity_type: 'page',
    entity_id: pageId,
  });

  // Fetch rest_base_url from database
  const { data: siteData } = await supabaseAdmin
    .from('sites')
    .select('rest_base_url')
    .eq('id', context.siteId)
    .single();

  const wpClient = new WPAPIClient({
    siteUrl: context.siteUrl,
    siteId: context.siteId,
    secret: context.siteSecret,
    restBaseUrl: siteData?.rest_base_url || undefined,
  });

  try {
    // Fetch page data with retry
    const page = await withRetry(
      async () => {
        return await wpClient.getPage(parseInt(pageId, 10), requestId);
      },
      WP_API_RETRY_OPTIONS
    ).catch((error) => {
      logWPAPIFailure(logger, error instanceof Error ? error : new Error('Unknown error'), {
        operation: 'getPage',
        page_id: pageId,
      });
      throw error;
    });

    // Build text content
    const text = buildPageText(page);
    const fullContentHash = generateContentHash(text);

    // Check for existing embeddings with same content hash (deduplication)
    const { data: existingEmbeddings } = await supabaseAdmin
      .from('embeddings')
      .select('metadata')
      .eq('site_id', context.siteId)
      .eq('entity_type', 'page')
      .eq('entity_id', pageId)
      .eq('metadata->>full_content_hash', fullContentHash)
      .limit(1);

    if (existingEmbeddings && existingEmbeddings.length > 0) {
      logger.info('Skipping ingestion - content unchanged', {
        page_id: pageId,
        content_hash: fullContentHash,
      });
      return {
        success: true,
        embeddingsCreated: 0,
        tokensUsed: 0,
      };
    }

    // Get existing chunk hashes for deduplication
    const { data: existingChunks } = await supabaseAdmin
      .from('embeddings')
      .select('metadata->>chunk_hash')
      .eq('site_id', context.siteId)
      .eq('entity_type', 'page')
      .eq('entity_id', pageId);

    const existingHashes = new Set<string>();
    if (existingChunks) {
      for (const chunk of existingChunks) {
        const hash = chunk['chunk_hash'];
        if (hash) existingHashes.add(hash);
      }
    }

    // Generate embeddings with chunking and batching
    const { embeddings, totalTokens, model, skipped } =
      await generateEmbeddingsWithChunking(text, 'text-embedding-3-small', 1000, 200, requestId, existingHashes);

    // Store embeddings in database
    let embeddingsCreated = 0;

    for (const { embedding, chunkMetadata } of embeddings) {
      // Get current version for this entity
      const { data: existing } = await supabaseAdmin
        .from('embeddings')
        .select('version')
        .eq('site_id', context.siteId)
        .eq('entity_type', 'page')
        .eq('entity_id', pageId)
        .order('version', { ascending: false })
        .limit(1)
        .single();

      const nextVersion = existing ? existing.version + 1 : 1;

      // Store embedding with chunking metadata
      // pgvector expects array format, Supabase will convert it
      const { error: insertError } = await supabaseAdmin
        .from('embeddings')
        .insert({
          site_id: context.siteId,
          tenant_id: context.tenantId,
          entity_type: 'page',
          entity_id: pageId,
          content_text: chunkMetadata.chunk_text,
          embedding: embedding, // pgvector accepts array directly
          model,
          version: nextVersion,
          metadata: {
            chunk_index: chunkMetadata.chunk_index,
            chunk_hash: chunkMetadata.chunk_hash,
            start_char: chunkMetadata.start_char,
            end_char: chunkMetadata.end_char,
            page_id: page.id,
            page_title: page.title,
            page_url: page.url,
            page_type: page.type,
            full_content_hash: fullContentHash, // Use full content hash for deduplication
          } as any,
        });

      if (insertError) {
        console.error('Error storing embedding:', insertError);
        throw new Error(`Failed to store embedding: ${insertError.message}`);
      }

      embeddingsCreated++;
    }

    logger.info('Page ingestion completed', {
      embeddings_created: embeddingsCreated,
      tokens_used: totalTokens,
      chunks_skipped: skipped,
    });

    // Log embedding usage
    await logEmbeddingUsage({
      site_id: context.siteId,
      tenant_id: context.tenantId,
      model,
      prompt_tokens: totalTokens,
      completion_tokens: 0,
      total_tokens: totalTokens,
      latency_ms: 0,
      success: true,
    });

    return {
      success: true,
      embeddingsCreated,
      tokensUsed: totalTokens,
    };
  } catch (error) {
    logger.error('Page ingestion failed', error instanceof Error ? error : new Error('Unknown error'));

    // Log failed embedding usage
    await logEmbeddingUsage({
      site_id: context.siteId,
      tenant_id: context.tenantId,
      model: 'text-embedding-3-small',
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      latency_ms: 0,
      success: false,
      error_code: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });

    return {
      success: false,
      embeddingsCreated: 0,
      tokensUsed: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete embeddings for an entity
 */
export async function deleteEntityEmbeddings(
  context: IngestionContext,
  entityType: 'product' | 'page' | 'policy',
  entityId: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('embeddings')
    .delete()
    .eq('site_id', context.siteId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (error) {
    throw new Error(`Failed to delete embeddings: ${error.message}`);
  }
}

/**
 * Batch ingest multiple products
 */
export async function ingestProductsBatch(
  context: IngestionContext,
  productIds: string[]
): Promise<{
  results: Array<{ productId: string; result: IngestionResult }>;
  totalEmbeddings: number;
  totalTokens: number;
}> {
  const results: Array<{ productId: string; result: IngestionResult }> = [];
  let totalEmbeddings = 0;
  let totalTokens = 0;

  // Process in parallel (with concurrency limit)
  const concurrency = 5;
  for (let i = 0; i < productIds.length; i += concurrency) {
    const batch = productIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (productId) => {
        const result = await ingestProduct(context, productId);
        return { productId, result };
      })
    );

    results.push(...batchResults);

    for (const { result } of batchResults) {
      totalEmbeddings += result.embeddingsCreated;
      totalTokens += result.tokensUsed;
    }
  }

  return {
    results,
    totalEmbeddings,
    totalTokens,
  };
}
