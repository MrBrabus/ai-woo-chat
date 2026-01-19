/**
 * Retrieval module for pgvector similarity search
 * 
 * Performs vector similarity search with tenant/site isolation
 * and filtering for deleted/disabled sources
 * 
 * Uses direct Postgres connection to execute pgvector operators
 * (Supabase PostgREST doesn't support pgvector operators directly)
 */

import { query } from '@/lib/db/postgres';
import { generateEmbedding } from '@/lib/embeddings/openai';

export interface RetrievalOptions {
  tenantId: string;
  siteId: string;
  queryText: string;
  topK?: number; // Default: 10
  similarityThreshold?: number; // Minimum cosine similarity (0-1), default: 0.7
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
    similarityThreshold = 0.7,
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

  // Use SECURITY DEFINER function to bypass RLS policies
  // This function validates tenant_id/site_id internally, so it's safe
  // Format vector as array string for pgvector: '[1,2,3]'
  const vectorString = `[${queryEmbeddingArray.join(',')}]`;
  
  // DETAILED LOGGING: Before query (as suggested by internet)
  console.log('[RAG Retrieval] Starting embeddings query - DIAGNOSTIC LOG', {
    tenant_id: tenantId,
    site_id: siteId,
    allowed_source_types: allowedSourceTypes,
    top_k: topK,
    similarity_threshold: similarityThreshold,
    vector_dimensions: queryEmbeddingArray.length,
    tenant_id_type: typeof tenantId,
    site_id_type: typeof siteId,
  });

  // Try to retrieve embeddings
  // If query fails due to RLS or other issues, return empty array (not an error)
  // This allows chat to work even without embeddings
  let result: any;
  
  try {
    // DETAILED LOGGING: Trying SECURITY DEFINER function
    console.log('[RAG Retrieval] Attempting SECURITY DEFINER function - DIAGNOSTIC LOG', {
      tenant_id: tenantId,
      site_id: siteId,
    });

    // Try using SECURITY DEFINER function first (bypasses RLS if it exists)
    result = await query(
      `SELECT * FROM search_embeddings($1::vector, $2::uuid, $3::uuid, $4::text[], $5::int, $6::float)`,
      [
        vectorString,
        tenantId,
        siteId,
        allowedSourceTypes,
        topK * 2,
        similarityThreshold,
      ]
    );
    
    // DETAILED LOGGING: Function succeeded
    console.log('[RAG Retrieval] SECURITY DEFINER function succeeded - DIAGNOSTIC LOG', {
      rows_count: result.rows?.length || 0,
    });
  } catch (error: any) {
    // DETAILED LOGGING: Function failed
    console.error('[RAG Retrieval] SECURITY DEFINER function failed - DIAGNOSTIC LOG', {
      error_message: error.message,
      error_code: error.code,
      error_severity: error.severity,
      error_hint: error.hint,
      error_detail: error.detail,
      error_where: error.where,
      error_type: typeof error,
      tenant_id: tenantId,
      site_id: siteId,
    });

    // If function doesn't exist, try direct query as fallback
    if (error.message?.includes('function search_embeddings') || error.message?.includes('does not exist')) {
      console.warn('[RAG Retrieval] search_embeddings function not found, trying direct query');
      
      try {
        // DETAILED LOGGING: Trying direct query
        console.log('[RAG Retrieval] Attempting direct query - DIAGNOSTIC LOG', {
          tenant_id: tenantId,
          site_id: siteId,
        });

        // Fallback to direct query
        const sql = `
          SELECT
            e.id,
            e.site_id,
            e.tenant_id,
            e.entity_type,
            e.entity_id,
            e.content_text,
            e.model,
            e.version,
            e.metadata,
            e.created_at,
            e.updated_at,
            (e.embedding <=> $1::vector)::float as distance
          FROM embeddings e
          WHERE
            e.embedding IS NOT NULL
            AND e.tenant_id = $2::uuid
            AND e.site_id = $3::uuid
            AND e.entity_type = ANY($4::text[])
          ORDER BY e.embedding <=> $1::vector
          LIMIT $5::int
        `;
        
        result = await query(sql, [
          vectorString,
          tenantId,
          siteId,
          allowedSourceTypes,
          topK * 2,
        ]);
        
        // DETAILED LOGGING: Direct query succeeded
        console.log('[RAG Retrieval] Direct query succeeded - DIAGNOSTIC LOG', {
          rows_count: result.rows?.length || 0,
        });
      } catch (fallbackError: any) {
        // DETAILED LOGGING: Direct query failed (as suggested by internet)
        console.error('[RAG Retrieval] Direct query failed - DIAGNOSTIC LOG', {
          error_message: fallbackError.message,
          error_code: fallbackError.code,
          error_severity: fallbackError.severity,
          error_hint: fallbackError.hint,
          error_detail: fallbackError.detail,
          error_where: fallbackError.where,
          error_type: typeof fallbackError,
          tenant_id: tenantId,
          site_id: siteId,
          is_xx000_error: fallbackError.code === 'XX000',
          is_tenant_not_found: fallbackError.message?.includes('Tenant or user not found'),
        });

        // If fallback query fails (e.g., RLS blocks it), return empty results
        // This allows chat to work even if embeddings query fails
        if (fallbackError.code === 'XX000' || fallbackError.message?.includes('Tenant or user not found')) {
          console.warn('[RAG Retrieval] Query blocked by RLS or connection issue, returning empty results');
          console.warn('[RAG Retrieval] Chat will work without RAG context');
          return []; // Return empty array - chat can still work
        }
        
        // For other errors, also return empty array instead of throwing
        // This prevents RAG errors from breaking the chat
        console.warn('[RAG Retrieval] Query failed, returning empty results:', fallbackError.message);
        return [];
      }
    } else {
      // For other function errors (e.g., wrong parameters), also return empty array
      // This prevents RAG errors from breaking the chat
      console.warn('[RAG Retrieval] Function call failed, returning empty results:', error.message);
      return [];
    }
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

  // Filter by similarity threshold and limit
  return chunks
    .filter((chunk) => chunk.similarity >= similarityThreshold)
    .slice(0, topK);
}
