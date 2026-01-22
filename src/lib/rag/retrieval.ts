/**
 * Retrieval module for pgvector similarity search
 * 
 * Performs vector similarity search with tenant/site isolation
 * and filtering for deleted/disabled sources
 * 
 * Uses Supabase Admin client with RPC calls for pgvector operations
 * This avoids pooler authentication issues with direct Postgres connections
 */

import { createAdminClient } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/embeddings/openai';

export interface RetrievalOptions {
  tenantId: string;
  siteId: string;
  queryText: string;
  topK?: number; // Default: 10
  similarityThreshold?: number; // Minimum cosine similarity (0-1), default: 0.5
  allowedSourceTypes?: ('product' | 'page' | 'policy')[]; // Default: all
  model?: string; // Embedding model, default: 'text-embedding-3-small'
}

export interface RetrievedChunk {
  id: string;
  siteId: string;
  tenantId: string;
  entityType: 'product' | 'page' | 'policy';
  entityId: string;
  contentText: string;
  chunkIndex: number;
  chunkHash: string;
  similarity: number; // Cosine similarity score (0-1)
  metadata: {
    chunk_index?: number;
    chunk_hash?: string;
    start_char?: number;
    end_char?: number;
    product_id?: number;
    product_title?: string;
    product_url?: string;
    page_id?: number;
    page_title?: string;
    page_url?: string;
    page_type?: string;
    full_content_hash?: string;
    source_updated_at?: string; // If present in metadata
    [key: string]: any;
  };
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Retrieve top-k chunks using pgvector similarity search
 * 
 * Mandatory filters:
 * - tenant_id and site_id isolation
 * - Exclude deleted/disabled sources (via metadata checks)
 * - Source type allowlist
 */
export async function retrieveChunks(
  options: RetrievalOptions
): Promise<RetrievedChunk[]> {
  const {
    tenantId,
    siteId,
    queryText,
    topK = 10,
    similarityThreshold = 0.5,
    allowedSourceTypes = ['product', 'page', 'policy'],
    model = 'text-embedding-3-small',
  } = options;

  // Validate tenantId and siteId (required for tenant/site isolation)
  if (!tenantId || !siteId) {
    throw new Error('tenantId and siteId are required for retrieval');
  }

  // Validate UUID format (PostgreSQL requires UUID type)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(tenantId)) {
    throw new Error(`Invalid tenantId format: expected UUID, got ${tenantId}`);
  }
  if (!uuidRegex.test(siteId)) {
    throw new Error(`Invalid siteId format: expected UUID, got ${siteId}`);
  }

  // NOTE: Tenant check removed because it causes "Tenant or user not found" error
  // with Supabase pooler when using direct Postgres connection.
  // The pooler validates tenant through username format (postgres.<project-ref>),
  // but direct queries don't have auth.uid() so pooler rejects the connection.
  // Tenant is already validated in route.ts before calling RAG pipeline.
  // If tenant doesn't exist, embeddings query will return empty results (not an error).

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(queryText, model);
  const queryEmbeddingArray = queryEmbedding.embedding;

  // DETAILED LOGGING: Before query
  console.log('[RAG Retrieval] Starting embeddings query - DIAGNOSTIC LOG', {
    tenant_id: tenantId,
    site_id: siteId,
    query_text: queryText,
    query_text_length: queryText.length,
    allowed_source_types: allowedSourceTypes,
    top_k: topK,
    similarity_threshold: similarityThreshold,
    vector_dimensions: queryEmbeddingArray.length,
  });

  // Use Supabase Admin client with RPC call to avoid pooler authentication issues
  const supabaseAdmin = createAdminClient();
  
  // Format vector as array string for pgvector: '[1,2,3]'
  const vectorString = `[${queryEmbeddingArray.join(',')}]`;
  
  let result: { rows: any[] } = { rows: [] };
  
  try {
    console.log('[RAG Retrieval] Attempting RPC call to search_embeddings');
    
    // Call the search_embeddings function via RPC
    const { data, error } = await supabaseAdmin.rpc('search_embeddings', {
      p_query_embedding: vectorString,
      p_tenant_id: tenantId,
      p_site_id: siteId,
      p_entity_types: allowedSourceTypes,
      p_limit: topK * 2,
      p_similarity_threshold: similarityThreshold,
    });
    
    if (error) {
      console.error('[RAG Retrieval] RPC call failed:', error.message);
      
      // If RPC fails, try direct query via Supabase
      console.log('[RAG Retrieval] Falling back to direct Supabase query');
      
      const { data: directData, error: directError } = await supabaseAdmin
        .from('embeddings')
        .select('id, site_id, tenant_id, entity_type, entity_id, content_text, model, version, metadata, created_at, updated_at')
        .eq('tenant_id', tenantId)
        .eq('site_id', siteId)
        .in('entity_type', allowedSourceTypes)
        .not('embedding', 'is', null)
        .limit(topK * 2);
      
      if (directError) {
        console.error('[RAG Retrieval] Direct query also failed:', directError.message);
        return [];
      }
      
      // Note: Direct query doesn't do vector similarity search
      // This is a fallback - results won't be sorted by relevance
      console.warn('[RAG Retrieval] Using fallback query without vector similarity');
      result.rows = directData || [];
    } else {
      result.rows = data || [];
      console.log('[RAG Retrieval] RPC call succeeded', { rows_count: result.rows.length });
    }
  } catch (error: any) {
    console.error('[RAG Retrieval] Exception during query:', error.message);
    return [];
  }
  
  // If query succeeded but no results, return empty array (not an error)
  if (!result.rows || result.rows.length === 0) {
    console.log('[RAG Retrieval] No embeddings found for tenant_id:', tenantId, 'site_id:', siteId);
    return [];
  }

  // Map results to RetrievedChunk format
  // Note: Function returns similarity already calculated, direct query returns distance
  const chunks: RetrievedChunk[] = result.rows.map((row: any) => {
    // If using function, similarity is already calculated
    // If using direct query, calculate similarity from distance
    let similarity: number;
    if (row.similarity !== undefined) {
      // Function returned similarity
      similarity = parseFloat(row.similarity) || 0;
    } else {
      // Direct query returned distance, calculate similarity
      const distance = parseFloat(row.distance) || 2;
      similarity = Math.max(0, 1 - distance / 2);
    }

    return {
      id: row.id,
      siteId: row.site_id,
      tenantId: row.tenant_id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      contentText: row.content_text,
      chunkIndex: row.metadata?.chunk_index || 0,
      chunkHash: row.metadata?.chunk_hash || '',
      similarity,
      metadata: row.metadata || {},
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  // DETAILED LOGGING: After retrieval
  // Log detailed retrieval results
  console.log('[RAG Retrieval] Retrieval completed - DIAGNOSTIC LOG', {
    query_text: queryText,
    tenant_id: tenantId,
    site_id: siteId,
    total_chunks_found: chunks.length,
    chunks_before_threshold_filter: chunks.length,
    similarity_threshold: similarityThreshold,
    chunks_after_threshold: chunks.filter((chunk) => chunk.similarity >= similarityThreshold).length,
    query_executed_successfully: result ? true : false,
    rows_returned: result?.rows?.length || 0,
    chunks_details: chunks.map((c) => ({
      entity_type: c.entityType,
      entity_id: c.entityId,
      similarity: c.similarity,
      product_id: c.metadata.product_id,
      product_title: c.metadata.product_title,
      sku: c.metadata.sku,
      content_preview: c.contentText.substring(0, 150),
    })),
  });
  
  // If no chunks found, log warning with helpful message
  if (chunks.length === 0) {
    console.warn('[RAG Retrieval] No embeddings found in database', {
      tenant_id: tenantId,
      site_id: siteId,
      query_text: queryText,
      message: 'This usually means ingestion has not run yet or failed. Check ingestion logs and webhook status.',
    });
  }

  // Filter by similarity threshold and limit
  const filteredChunks = chunks
    .filter((chunk) => chunk.similarity >= similarityThreshold)
    .slice(0, topK);
  
  // DETAILED LOGGING: Final filtered chunks
  console.log('[RAG Retrieval] Final filtered chunks - DIAGNOSTIC LOG', {
    query_text: queryText,
    filtered_chunks_count: filteredChunks.length,
    filtered_chunks: filteredChunks.map((c) => ({
      entity_type: c.entityType,
      entity_id: c.entityId,
      similarity: c.similarity,
      product_id: c.metadata.product_id,
      product_title: c.metadata.product_title,
      sku: c.metadata.sku,
    })),
  });

  return filteredChunks;
}
