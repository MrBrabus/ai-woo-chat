/**
 * Evidence model for citations
 * 
 * Standard evidence output format for each answer:
 * - source_type, source_id, chunk_ids, score, title/url
 */

import { RetrievedChunk, ContextBlock } from './context-builder';

export interface Evidence {
  sourceType: 'product' | 'page' | 'policy';
  sourceId: string;
  chunkIds: string[];
  score: number; // Similarity score (0-1)
  title?: string;
  url?: string;
  sourceUpdatedAt?: string;
}

/**
 * Build evidence from context blocks
 */
export function buildEvidence(contextBlocks: ContextBlock[]): Evidence[] {
  return contextBlocks.map((block) => ({
    sourceType: block.sourceType,
    sourceId: block.sourceId,
    chunkIds: block.chunkIds,
    score: block.similarity,
    title: block.title,
    url: block.url,
    sourceUpdatedAt: block.sourceUpdatedAt,
  }));
}

/**
 * Build evidence from raw retrieved chunks (alternative)
 */
export function buildEvidenceFromChunks(chunks: RetrievedChunk[]): Evidence[] {
  // Group by source
  const sourceMap = new Map<string, RetrievedChunk[]>();

  for (const chunk of chunks) {
    const sourceKey = `${chunk.entityType}:${chunk.entityId}`;
    if (!sourceMap.has(sourceKey)) {
      sourceMap.set(sourceKey, []);
    }
    sourceMap.get(sourceKey)!.push(chunk);
  }

  // Build evidence for each source
  const evidence: Evidence[] = [];

  for (const [key, sourceChunks] of sourceMap.entries()) {
    const firstChunk = sourceChunks[0];
    const metadata = firstChunk.metadata;
    const bestScore = Math.max(...sourceChunks.map((c) => c.similarity));

    evidence.push({
      sourceType: firstChunk.entityType,
      sourceId: firstChunk.entityId,
      chunkIds: sourceChunks.map((c) => c.id),
      score: bestScore,
      title:
        metadata.product_title ||
        metadata.page_title ||
        metadata.title ||
        undefined,
      url: metadata.product_url || metadata.page_url || metadata.url || undefined,
      sourceUpdatedAt: metadata.source_updated_at || undefined,
    });
  }

  // Sort by score (highest first)
  return evidence.sort((a, b) => b.score - a.score);
}
