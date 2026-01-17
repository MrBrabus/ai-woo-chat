/**
 * RAG Core - Main entry point
 * 
 * Reusable retrieval and RAG building blocks
 */

export * from './retrieval';
export * from './context-builder';
export * from './evidence';
export * from './prompts';
export * from './guardrails';

/**
 * Complete RAG pipeline function
 * 
 * Takes a query and returns:
 * - Retrieved chunks
 * - Context blocks
 * - Evidence
 * - Assembled prompts
 */
export interface RAGPipelineOptions {
  tenantId: string;
  siteId: string;
  queryText: string;
  topK?: number;
  similarityThreshold?: number;
  allowedSourceTypes?: ('product' | 'page' | 'policy')[];
  maxContextTokens?: number;
  maxChunksPerSource?: number;
  maxSources?: number;
  model?: string;
}

export interface RAGPipelineResult {
  chunks: import('./retrieval').RetrievedChunk[];
  contextBlocks: import('./context-builder').ContextBlock[];
  evidence: import('./evidence').Evidence[];
  prompts: {
    systemPrompt: string;
    userPrompt: string;
    fullPrompt: string;
  };
}

export async function runRAGPipeline(
  options: RAGPipelineOptions
): Promise<RAGPipelineResult> {
  const {
    retrieveChunks,
  } = await import('./retrieval');
  const {
    buildContextBlocks,
  } = await import('./context-builder');
  const {
    buildEvidence,
  } = await import('./evidence');
  const {
    assemblePrompt,
  } = await import('./prompts');
  const {
    validateRetrievalRequest,
    sanitizeSourceTypes,
  } = await import('./guardrails');

  // Validate and sanitize source types
  const sanitizedTypes = sanitizeSourceTypes(
    options.allowedSourceTypes || []
  );
  const validation = validateRetrievalRequest(
    options.tenantId,
    options.siteId,
    sanitizedTypes
  );

  if (!validation.valid) {
    throw new Error(`Retrieval validation failed: ${validation.error}`);
  }

  // Retrieve chunks
  const chunks = await retrieveChunks({
    tenantId: options.tenantId,
    siteId: options.siteId,
    queryText: options.queryText,
    topK: options.topK,
    similarityThreshold: options.similarityThreshold,
    allowedSourceTypes: validation.allowedTypes,
    model: options.model,
  });

  // Build context blocks
  const contextBlocks = buildContextBlocks(chunks, {
    maxContextTokens: options.maxContextTokens,
    maxChunksPerSource: options.maxChunksPerSource,
    maxSources: options.maxSources,
  });

  // Build evidence
  const evidence = buildEvidence(contextBlocks);

  // Assemble prompts
  const prompts = assemblePrompt(options.queryText, contextBlocks);

  return {
    chunks,
    contextBlocks,
    evidence,
    prompts,
  };
}
