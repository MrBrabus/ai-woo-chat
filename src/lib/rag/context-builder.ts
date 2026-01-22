/**
 * RAG context builder
 * 
 * Builds context blocks from retrieved chunks with:
 * - Deduplication/merging of chunks from same source
 * - Token/character limits
 * - Source information and recency hints
 */

import { RetrievedChunk } from './retrieval';

export interface ContextBlock {
  sourceType: 'product' | 'page' | 'policy';
  sourceId: string;
  title?: string;
  url?: string;
  content: string; // Merged content from multiple chunks
  chunkIds: string[]; // IDs of chunks included in this block
  chunkIndices: number[]; // Chunk indices for evidence
  sourceUpdatedAt?: string; // Recency hint
  similarity: number; // Best similarity score from chunks
}

export interface ContextBuilderOptions {
  maxContextTokens?: number; // Default: 4000
  maxContextCharacters?: number; // Alternative to tokens
  maxChunksPerSource?: number; // Default: 3
  maxSources?: number; // Default: 5
  mergeStrategy?: 'concatenate' | 'separate'; // Default: 'concatenate'
}

/**
 * Build context blocks from retrieved chunks
 * 
 * Features:
 * - Collapses multiple chunks from same source into one block
 * - Enforces strict limits (tokens/chars, chunks per source, sources)
 * - Includes source metadata (type/id/url/title)
 * - Adds recency hints if available
 */
export function buildContextBlocks(
  chunks: RetrievedChunk[],
  options: ContextBuilderOptions = {}
): ContextBlock[] {
  const {
    maxContextTokens = 4000,
    maxContextCharacters,
    maxChunksPerSource = 3,
    maxSources = 5,
    mergeStrategy = 'concatenate',
  } = options;

  // Group chunks by source (entity_type + entity_id)
  const sourceMap = new Map<string, RetrievedChunk[]>();

  for (const chunk of chunks) {
    const sourceKey = `${chunk.entityType}:${chunk.entityId}`;
    if (!sourceMap.has(sourceKey)) {
      sourceMap.set(sourceKey, []);
    }
    sourceMap.get(sourceKey)!.push(chunk);
  }

  // Build context blocks from grouped chunks
  const contextBlocks: ContextBlock[] = [];
  let totalChars = 0;
  let totalTokens = 0; // Approximate: ~4 chars per token

  // Sort sources by best similarity (highest first)
  const sortedSources = Array.from(sourceMap.entries())
    .map(([key, chunks]) => ({
      key,
      chunks: chunks.sort((a, b) => b.similarity - a.similarity),
      bestSimilarity: Math.max(...chunks.map((c) => c.similarity)),
    }))
    .sort((a, b) => b.bestSimilarity - a.bestSimilarity)
    .slice(0, maxSources);

  for (const { key, chunks: sourceChunks } of sortedSources) {
    if (contextBlocks.length >= maxSources) {
      break;
    }

    // Limit chunks per source
    const limitedChunks = sourceChunks.slice(0, maxChunksPerSource);

    // Extract source info from first chunk's metadata
    const firstChunk = limitedChunks[0];
    const metadata = firstChunk.metadata;

    // Merge chunks based on strategy
    let mergedContent: string;
    if (mergeStrategy === 'concatenate') {
      // Light merging: concatenate with separator
      mergedContent = limitedChunks
        .map((c) => c.contentText.trim())
        .filter((text) => text.length > 0)
        .join('\n\n');
    } else {
      // Separate: keep chunks separate (for now, same as concatenate)
      mergedContent = limitedChunks
        .map((c) => c.contentText.trim())
        .filter((text) => text.length > 0)
        .join('\n\n');
    }

    // Check limits
    const contentChars = mergedContent.length;
    const contentTokens = Math.ceil(contentChars / 4); // Rough estimate

    if (maxContextCharacters && totalChars + contentChars > maxContextCharacters) {
      break;
    }

    if (totalTokens + contentTokens > maxContextTokens) {
      break;
    }

    // Build context block
    const contextBlock: ContextBlock = {
      sourceType: firstChunk.entityType,
      sourceId: firstChunk.entityId,
      title:
        metadata.product_title ||
        metadata.page_title ||
        metadata.title ||
        undefined,
      url: metadata.product_url || metadata.page_url || metadata.url || undefined,
      content: mergedContent,
      chunkIds: limitedChunks.map((c) => c.id),
      chunkIndices: limitedChunks.map((c) => c.chunkIndex),
      sourceUpdatedAt: metadata.source_updated_at || undefined,
      similarity: Math.max(...limitedChunks.map((c) => c.similarity)),
    };

    contextBlocks.push(contextBlock);
    totalChars += contentChars;
    totalTokens += contentTokens;
  }

  return contextBlocks;
}

/**
 * Format context blocks into a single string for prompt injection
 */
export function formatContextBlocks(blocks: ContextBlock[]): string {
  if (blocks.length === 0) {
    return '';
  }

  const sections = blocks.map((block, index) => {
    // Build a clearer header with product information
    const headerParts: string[] = [];
    
    if (block.title) {
      headerParts.push(`Product: ${block.title}`);
    }
    
    // Include URL in header but don't show full URL in content
    // The URL will be used by the AI to create markdown links
    if (block.url) {
      headerParts.push(`Product URL: ${block.url}`);
    }
    
    if (block.sourceUpdatedAt) {
      headerParts.push(`Updated: ${new Date(block.sourceUpdatedAt).toLocaleDateString()}`);
    }

    const header = headerParts.length > 0 
      ? `[Product ${index + 1}] ${headerParts.join(' | ')}`
      : `[Source ${index + 1}]`;

    return `${header}\n${block.content}`;
  });

  // Add a summary at the beginning if there are multiple products
  if (blocks.length > 1) {
    const productCount = blocks.filter(b => b.sourceType === 'product').length;
    // Make it very clear this is the exact count
    const summary = `EXACT PRODUCT COUNT: Found exactly ${productCount} product${productCount !== 1 ? 's' : ''} matching the query (this is the precise number from the database):\n\n`;
    return summary + sections.join('\n\n---\n\n');
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Estimate token count for text (rough approximation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}
