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

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(queryText, model);
  const queryEmbeddingArray = queryEmbedding.embedding;

  // Perform pgvector similarity search using direct Postgres query
  // The <=> operator computes cosine distance (0 = identical, 2 = opposite)
  // We convert to similarity: similarity = 1 - (distance / 2)
  
  // Build parameterized SQL query with mandatory filters
  // Format vector as array string for pgvector: '[1,2,3]'
  const vectorString = `[${queryEmbeddingArray.join(',')}]`;
  
  const hasEntityTypeFilter = allowedSourceTypes.length > 0;
  const sql = hasEntityTypeFilter
    ? `
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
    `
    : `
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
      ORDER BY e.embedding <=> $1::vector
      LIMIT $4::int
    `;

  // Prepare parameters
  const params: any[] = [
    vectorString, // Query embedding as vector string format
    tenantId,
    siteId,
  ];

  if (hasEntityTypeFilter) {
    params.push(allowedSourceTypes);
    params.push(topK * 2); // Get more results to filter, then limit
  } else {
    params.push(topK * 2);
  }

  // Execute query
  const result = await query(sql, params);

  // Map results to RetrievedChunk format
  const chunks: RetrievedChunk[] = result.rows.map((row: any) => {
    // Distance: 0 = identical, 2 = opposite
    // Convert to similarity: similarity = 1 - (distance / 2)
    const distance = parseFloat(row.distance) || 2;
    const similarity = Math.max(0, 1 - distance / 2);

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
