/**
 * Test harness for RAG retrieval and context building
 * 
 * Dev-only script to test:
 * query → retrieval → context build
 * Prints selected chunks + evidence
 */

import { runRAGPipeline, RAGPipelineOptions } from './index';

/**
 * Test RAG pipeline with a query
 * 
 * Usage (dev only):
 * ```ts
 * await testRAGPipeline({
 *   tenantId: '...',
 *   siteId: '...',
 *   queryText: 'Do you have wireless headphones?'
 * });
 * ```
 */
export async function testRAGPipeline(options: RAGPipelineOptions) {
  console.log('🔍 RAG Pipeline Test');
  console.log('='.repeat(60));
  console.log(`Query: "${options.queryText}"`);
  console.log(`Tenant ID: ${options.tenantId}`);
  console.log(`Site ID: ${options.siteId}`);
  console.log('='.repeat(60));
  console.log();

  try {
    const startTime = Date.now();

    const result = await runRAGPipeline(options);

    const duration = Date.now() - startTime;

    console.log(`✅ Retrieval completed in ${duration}ms`);
    console.log();

    // Print retrieved chunks
    console.log(`📦 Retrieved Chunks (${result.chunks.length}):`);
    console.log('-'.repeat(60));
    result.chunks.forEach((chunk, index) => {
      console.log(`\n[${index + 1}] Chunk ID: ${chunk.id}`);
      console.log(`    Source: ${chunk.entityType}:${chunk.entityId}`);
      console.log(`    Similarity: ${(chunk.similarity * 100).toFixed(2)}%`);
      console.log(`    Chunk Index: ${chunk.chunkIndex}`);
      console.log(`    Content Preview: ${chunk.contentText.substring(0, 100)}...`);
      if (chunk.metadata.product_title) {
        console.log(`    Product: ${chunk.metadata.product_title}`);
      }
      if (chunk.metadata.page_title) {
        console.log(`    Page: ${chunk.metadata.page_title}`);
      }
    });
    console.log();

    // Print context blocks
    console.log(`📚 Context Blocks (${result.contextBlocks.length}):`);
    console.log('-'.repeat(60));
    result.contextBlocks.forEach((block, index) => {
      console.log(`\n[${index + 1}] ${block.sourceType}:${block.sourceId}`);
      if (block.title) {
        console.log(`    Title: ${block.title}`);
      }
      if (block.url) {
        console.log(`    URL: ${block.url}`);
      }
      console.log(`    Similarity: ${(block.similarity * 100).toFixed(2)}%`);
      console.log(`    Chunks: ${block.chunkIds.length} (${block.chunkIds.join(', ')})`);
      console.log(`    Content Length: ${block.content.length} chars`);
      console.log(`    Content Preview: ${block.content.substring(0, 150)}...`);
    });
    console.log();

    // Print evidence
    console.log(`📋 Evidence (${result.evidence.length}):`);
    console.log('-'.repeat(60));
    result.evidence.forEach((ev, index) => {
      console.log(`\n[${index + 1}] ${ev.sourceType}:${ev.sourceId}`);
      console.log(`    Score: ${(ev.score * 100).toFixed(2)}%`);
      if (ev.title) {
        console.log(`    Title: ${ev.title}`);
      }
      if (ev.url) {
        console.log(`    URL: ${ev.url}`);
      }
      console.log(`    Chunk IDs: ${ev.chunkIds.join(', ')}`);
    });
    console.log();

    // Print prompt preview
    console.log(`💬 Prompt Preview:`);
    console.log('-'.repeat(60));
    console.log(`System Prompt (${result.prompts.systemPrompt.length} chars):`);
    console.log(result.prompts.systemPrompt.substring(0, 300) + '...');
    console.log();
    console.log(`User Prompt (${result.prompts.userPrompt.length} chars):`);
    console.log(result.prompts.userPrompt);
    console.log();

    return result;
  } catch (error) {
    console.error('❌ RAG Pipeline Test Failed:');
    console.error(error);
    throw error;
  }
}

/**
 * Simple test function for quick testing
 */
export async function quickTest(
  tenantId: string,
  siteId: string,
  queryText: string
) {
  return testRAGPipeline({
    tenantId,
    siteId,
    queryText,
    topK: 10,
    similarityThreshold: 0.7,
    maxContextTokens: 4000,
    maxChunksPerSource: 3,
    maxSources: 5,
  });
}
