/**
 * Usage logging for embedding generation during ingestion
 */

import { createAdminClient } from './supabase/server';
import {
  logUsageEvent,
  updateDailyUsage,
  calculateCost,
  UsageEventData,
} from './usage-tracking';

// Initialize Supabase client with service role key
const supabaseAdmin = createAdminClient();

export interface EmbeddingUsageData {
  site_id: string;
  tenant_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms?: number;
  success: boolean;
  error_code?: string | null;
}

/**
 * Log embedding usage during ingestion
 * Call this after generating embeddings for products/pages
 */
export async function logEmbeddingUsage(
  data: EmbeddingUsageData
): Promise<void> {
  const usageEvent: UsageEventData = {
    tenant_id: data.tenant_id,
    site_id: data.site_id,
    conversation_id: null, // Embeddings don't have conversations
    type: 'embedding',
    model: data.model,
    prompt_tokens: data.prompt_tokens,
    completion_tokens: data.completion_tokens,
    total_tokens: data.total_tokens,
    latency_ms: data.latency_ms,
    success: data.success,
    error_code: data.error_code,
  };

  // Log the event
  await logUsageEvent(supabaseAdmin, usageEvent);

  // Update daily aggregate if successful
  if (data.success) {
    const cost = calculateCost(
      data.model,
      data.prompt_tokens,
      data.completion_tokens
    );

    await updateDailyUsage(
      supabaseAdmin,
      data.site_id,
      data.tenant_id,
      'embedding',
      data.total_tokens,
      cost
    );
  }
}

/**
 * Helper to wrap embedding generation with usage logging
 */
export async function withEmbeddingUsageLogging<T>(
  site_id: string,
  tenant_id: string,
  model: string,
  embeddingFn: () => Promise<{ tokens: number; latency_ms: number }>
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await embeddingFn();
    const latency_ms = Date.now() - startTime;

    // Log successful embedding usage
    await logEmbeddingUsage({
      site_id,
      tenant_id,
      model,
      prompt_tokens: result.tokens,
      completion_tokens: 0, // Embeddings typically don't have completion tokens
      total_tokens: result.tokens,
      latency_ms,
      success: true,
    });

    return result as T;
  } catch (error) {
    const latency_ms = Date.now() - startTime;

    // Log failed embedding usage
    await logEmbeddingUsage({
      site_id,
      tenant_id,
      model,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      latency_ms,
      success: false,
      error_code: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
    });

    throw error;
  }
}
