# RAG Core Implementation

## Overview

To-Do #9: Retrieval + RAG Core has been fully implemented. This provides server-side building blocks for retrieval-augmented generation (RAG) with pgvector similarity search, context building, prompt assembly, and evidence tracking.

## Components

### 1. Retrieval Module (`src/lib/rag/retrieval.ts`)

**Function**: `retrieveChunks(options: RetrievalOptions)`

Performs pgvector similarity search with:
- Query embedding generation (OpenAI)
- Vector similarity search via RPC function
- Tenant/site isolation (mandatory filters)
- Source type allowlist
- Similarity threshold filtering
- Top-K results

**Key Features:**
- Uses `match_embeddings` RPC function for efficient vector search
- Falls back to direct query if RPC unavailable
- Cosine similarity calculation (0-1 range)
- Filters by tenant_id, site_id, and entity_type

**Options:**
- `tenantId`, `siteId`, `queryText` (required)
- `topK` (default: 10)
- `similarityThreshold` (default: 0.7)
- `allowedSourceTypes` (default: all)
- `model` (default: 'text-embedding-3-small')

### 2. RAG Context Builder (`src/lib/rag/context-builder.ts`)

**Function**: `buildContextBlocks(chunks, options)`

Builds context blocks from retrieved chunks with:
- Deduplication: collapses multiple chunks from same source
- Light merging: concatenates chunks with separator
- Source metadata: type/id/url/title
- Recency hints: source_updated_at if present
- Strict limits: tokens/chars, chunks per source, max sources

**Key Features:**
- Groups chunks by source (entity_type + entity_id)
- Sorts sources by best similarity
- Enforces limits: maxContextTokens, maxContextCharacters, maxChunksPerSource, maxSources
- Includes source information in context blocks

**Options:**
- `maxContextTokens` (default: 4000)
- `maxContextCharacters` (alternative)
- `maxChunksPerSource` (default: 3)
- `maxSources` (default: 5)
- `mergeStrategy` ('concatenate' | 'separate')

### 3. Prompt Assembly Helpers (`src/lib/rag/prompts.ts`)

**Functions:**
- `assemblePrompt()` - Single-shot prompt (system + context + user)
- `assembleChatPrompt()` - Chat format (separate system/user messages)
- `assembleConversationPrompt()` - Multi-turn with history

**Key Features:**
- Static system template (customizable)
- Injected RAG context
- User message handling
- Endpoint-agnostic (works with any LLM API)

**Default System Template:**
- E-commerce assistant role
- Guidelines for accuracy, citations, policies
- Context-aware responses

### 4. Evidence Model (`src/lib/rag/evidence.ts`)

**Functions:**
- `buildEvidence(contextBlocks)` - From context blocks
- `buildEvidenceFromChunks(chunks)` - From raw chunks

**Evidence Format:**
```typescript
{
  sourceType: 'product' | 'page' | 'policy',
  sourceId: string,
  chunkIds: string[],
  score: number, // Similarity (0-1)
  title?: string,
  url?: string,
  sourceUpdatedAt?: string
}
```

**Usage:**
- Attached to chat messages (To-Do #10)
- Displayed in dashboard (To-Do #13)
- Provides citations for answers

### 5. Safety/Guardrails (`src/lib/rag/guardrails.ts`)

**Functions:**
- `validateRetrievalRequest()` - Validates tenant/site/source types
- `sanitizeSourceTypes()` - Removes invalid types
- `createStrictPolicy()` - Strict allowlist policy
- `createPermissivePolicy()` - Permissive policy

**Key Features:**
- **Tenant isolation**: Requires tenant_id and site_id (prevents cross-tenant leakage)
- **Source type allowlist**: Only allowed types can be retrieved
- **Explicit validation**: Validates all retrieval requests

**Default Policy:**
- All source types allowed: ['product', 'page', 'policy']
- Explicit allowlist required: true

### 6. Test Harness (`src/lib/rag/test-harness.ts`)

**Functions:**
- `testRAGPipeline(options)` - Full pipeline test
- `quickTest(tenantId, siteId, queryText)` - Quick test

**Output:**
- Retrieved chunks with similarity scores
- Context blocks with source info
- Evidence with citations
- Prompt preview

**Usage (dev only):**
```typescript
import { quickTest } from '@/lib/rag/test-harness';

await quickTest(
  'tenant-id',
  'site-id',
  'Do you have wireless headphones?'
);
```

### 7. Main Entry Point (`src/lib/rag/index.ts`)

**Function**: `runRAGPipeline(options)`

Complete RAG pipeline that:
1. Validates retrieval request
2. Retrieves chunks
3. Builds context blocks
4. Generates evidence
5. Assembles prompts

**Returns:**
- `chunks`: Retrieved chunks
- `contextBlocks`: Merged context blocks
- `evidence`: Citation evidence
- `prompts`: Assembled prompts

## Database

### RPC Function: `match_embeddings`

Created in migration: `20240120000003_create_match_embeddings_rpc.sql`

**Parameters:**
- `query_embedding`: vector(1536)
- `match_threshold`: float (distance threshold)
- `match_count`: int (max results)
- `tenant_id_param`: uuid (filter)
- `site_id_param`: uuid (filter)
- `entity_types`: text[] (filter)

**Returns:**
- All embedding columns
- `distance`: float (cosine distance)

**Usage:**
- Efficient pgvector similarity search
- Uses HNSW index for fast approximate nearest neighbor
- Filters by tenant/site/entity_type

## Security

1. **Tenant Isolation**: All queries require tenant_id and site_id
2. **Source Type Allowlist**: Only explicitly allowed types can be retrieved
3. **No Cross-Tenant Leakage**: Validation ensures tenant/site match
4. **No CORS/Origin Validation**: Handled in endpoint layer (To-Do #10)

## Integration Points

### For To-Do #10 (Chat Endpoints):
- Use `runRAGPipeline()` to get context and prompts
- Attach `evidence` to chat messages
- Use `assembleChatPrompt()` for OpenAI chat format

### For To-Do #13 (Dashboard):
- Display `evidence` as citations
- Show source information (title, url, score)
- Track retrieval performance

## Example Usage

```typescript
import { runRAGPipeline } from '@/lib/rag';

const result = await runRAGPipeline({
  tenantId: 'tenant-123',
  siteId: 'site-456',
  queryText: 'Do you have wireless headphones?',
  topK: 10,
  similarityThreshold: 0.7,
  allowedSourceTypes: ['product'],
  maxContextTokens: 4000,
  maxSources: 5,
});

// Use result.prompts for LLM
// Use result.evidence for citations
// Use result.contextBlocks for debugging
```

## Notes

1. **RPC Function**: The `match_embeddings` RPC function must be created in Supabase. Migration provided.

2. **Fallback**: If RPC function doesn't exist, retrieval falls back to direct query (less efficient).

3. **Token Estimation**: Uses rough estimate (~4 chars per token). For accurate token counting, use tiktoken or similar.

4. **Similarity Calculation**: Converts pgvector distance (0-2) to similarity (0-1) using: `similarity = 1 - (distance / 2)`

5. **Chunk Merging**: Light merging strategy concatenates chunks with `\n\n` separator. No semantic merging.

6. **No Streaming**: Prompt assembly is synchronous. Streaming handled in endpoint layer (To-Do #10).

## Testing

Run test harness in dev environment:
```typescript
import { quickTest } from '@/lib/rag/test-harness';

await quickTest(tenantId, siteId, 'test query');
```

Output includes:
- Retrieved chunks with scores
- Context blocks with source info
- Evidence citations
- Prompt preview
