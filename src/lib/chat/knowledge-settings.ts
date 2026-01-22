/**
 * Knowledge settings utilities
 * 
 * Handles loading and applying knowledge settings to RAG pipeline
 */

import { createAdminClient } from '@/lib/supabase/server';

export interface KnowledgeSettings {
  include_products: boolean;
  include_pages: boolean;
  include_policies: boolean;
  include_faq: boolean;
  auto_index_enabled: boolean;
  chunk_size: number;
  top_k_results: number;
  similarity_threshold?: number;
  max_context_tokens?: number;
  max_chunks_per_source?: number;
  max_sources?: number;
  embedding_model?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
  recency_bias?: boolean;
  source_priority?: {
    product?: number;
    page?: number;
    policy?: number;
    faq?: number;
  };
}

const supabaseAdmin = createAdminClient();

/**
 * Load knowledge settings for a site
 */
export async function loadKnowledgeSettings(siteId: string): Promise<KnowledgeSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('site_id', siteId)
      .eq('key', 'knowledge')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return defaults
      return {
        include_products: true,
        include_pages: true,
        include_policies: true,
        include_faq: false,
        auto_index_enabled: true,
        chunk_size: 1000,
        top_k_results: 10,
        similarity_threshold: 0.5,
        max_context_tokens: 4000,
        max_chunks_per_source: 3,
        max_sources: 5,
        embedding_model: 'text-embedding-3-small',
        recency_bias: false,
        source_priority: {
          product: 1.0,
          page: 1.0,
          policy: 1.0,
          faq: 1.0,
        },
      };
    }

    const knowledgeSettings = data.value as any;
    return {
      include_products: knowledgeSettings.include_products !== false,
      include_pages: knowledgeSettings.include_pages !== false,
      include_policies: knowledgeSettings.include_policies !== false,
      include_faq: knowledgeSettings.include_faq === true,
      auto_index_enabled: knowledgeSettings.auto_index_enabled !== false,
      chunk_size: knowledgeSettings.chunk_size || 1000,
      top_k_results: knowledgeSettings.top_k_results || 10,
      similarity_threshold: knowledgeSettings.similarity_threshold ?? 0.5,
      max_context_tokens: knowledgeSettings.max_context_tokens ?? 4000,
      max_chunks_per_source: knowledgeSettings.max_chunks_per_source ?? 3,
      max_sources: knowledgeSettings.max_sources ?? 5,
      embedding_model: knowledgeSettings.embedding_model || 'text-embedding-3-small',
      recency_bias: knowledgeSettings.recency_bias === true,
      source_priority: knowledgeSettings.source_priority || {
        product: 1.0,
        page: 1.0,
        policy: 1.0,
        faq: 1.0,
      },
    };
  } catch (error) {
    console.error('Error loading knowledge settings:', error);
    // Return defaults on error
    return {
      include_products: true,
      include_pages: true,
      include_policies: true,
      include_faq: false,
      auto_index_enabled: true,
      chunk_size: 1000,
      top_k_results: 10,
      similarity_threshold: 0.5,
      max_context_tokens: 4000,
      max_chunks_per_source: 3,
      max_sources: 5,
      embedding_model: 'text-embedding-3-small',
      recency_bias: false,
      source_priority: {
        product: 1.0,
        page: 1.0,
        policy: 1.0,
        faq: 1.0,
      },
    };
  }
}

/**
 * Get allowed source types from knowledge settings
 */
export function getAllowedSourceTypes(settings: KnowledgeSettings): string[] {
  const types: string[] = [];
  if (settings.include_products) types.push('product');
  if (settings.include_pages) types.push('page');
  if (settings.include_policies) types.push('policy');
  if (settings.include_faq) types.push('faq');
  return types.length > 0 ? types : ['product', 'page', 'policy']; // Fallback to defaults
}
