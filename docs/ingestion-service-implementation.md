# Ingestion Service Implementation

## Overview

The ingestion service has been fully implemented according to To-Do #8. It handles webhook events from WordPress, validates HMAC signatures, ensures idempotency, fetches content, generates embeddings, and stores them in pgvector.

## Components

### 1. HMAC Validation (`src/lib/hmac/validator.ts`)

- Validates HMAC-SHA256 signatures from WordPress requests
- Implements canonical string format: `{METHOD}\n{PATH}\n{TS}\n{NONCE}\n{BODY_HASH}`
- Enforces timestamp tolerance: ±5 minutes
- Prevents nonce replay attacks (10-minute window)
- In-memory nonce cache with automatic cleanup

**Key Features:**
- Timing-safe signature comparison
- Site validation and status checking
- Returns site_id and secret for downstream use

### 2. WordPress API Client (`src/lib/wordpress/client.ts`)

- Makes HMAC-signed requests to WordPress plugin REST endpoints
- Supports batch operations for efficient data retrieval
- Handles all required WordPress endpoints:
  - `GET /site/context` - Site context information
  - `GET /products/changed` - Paginated list of changed products
  - `GET /product/{id}` - Single product data
  - `POST /products/batch` - Batch product retrieval (up to 100 per request)
  - `GET /page/{id}` - Page content (placeholder, may need WP plugin implementation)

**Key Features:**
- Automatic HMAC header generation
- Batch processing with automatic chunking (100 items per batch)
- Error handling with proper error messages

### 3. OpenAI Embeddings (`src/lib/embeddings/openai.ts`)

- Generates embeddings using OpenAI API
- Implements content hashing for deduplication
- Text chunking with configurable size and overlap
- Supports `text-embedding-3-small` model (1536 dimensions)

**Key Features:**
- Content hashing (SHA256) for each chunk
- Configurable chunking (default: 1000 chars, 200 overlap)
- Chunk metadata tracking (index, hash, character positions)
- Text builders for products and pages

### 4. Ingestion Service (`src/lib/ingestion/service.ts`)

- Orchestrates the complete ingestion pipeline
- Handles product and page ingestion
- Manages embedding versioning
- Stores chunking metadata in JSONB

**Key Functions:**
- `ingestProduct()` - Ingest a single product
- `ingestPage()` - Ingest a single page
- `deleteEntityEmbeddings()` - Delete embeddings for deleted entities
- `ingestProductsBatch()` - Batch ingestion with concurrency control

**Storage:**
- Embeddings stored in `embeddings` table with pgvector
- Chunking metadata stored in `metadata` JSONB column:
  - `chunk_index` - Chunk position
  - `chunk_hash` - Content hash for deduplication
  - `start_char` / `end_char` - Character positions
  - Entity-specific metadata (product_id, page_id, etc.)

### 5. Webhook Handler (`src/api/ingestion/webhook/route.ts`)

- Receives webhook events from WordPress
- Validates HMAC signatures
- Implements event_id idempotency
- Processes ingestion events

**Event Types Supported:**
- `product.updated` - Product created or updated
- `product.deleted` - Product deleted
- `page.updated` - Page created or updated
- `page.deleted` - Page deleted
- `policy.updated` - Policy/setting page updated

**Idempotency:**
- Checks `ingestion_events` table for duplicate `event_id`
- Returns `{status: "duplicate"}` for duplicate events
- Handles race conditions with unique constraint

**Processing Flow:**
1. Validate request body and event type
2. Validate HMAC signature
3. Check license kill-switch
4. Check for duplicate event_id (idempotency)
5. Insert event record with 'processing' status
6. Process ingestion (fetch, embed, store)
7. Update event status ('completed' or 'failed')

## Database Schema Usage

### `ingestion_events` Table
- Stores webhook events for idempotency
- Tracks processing status
- Records errors and metadata

### `embeddings` Table
- Stores vector embeddings with pgvector
- Version tracking per entity
- Chunking metadata in JSONB `metadata` column
- Unique constraint: `(site_id, entity_type, entity_id, version)`

## Security

1. **HMAC Validation**: All webhook requests validated with HMAC-SHA256
2. **Nonce Replay Prevention**: 10-minute window, in-memory cache
3. **Timestamp Tolerance**: ±5 minutes
4. **License Kill-Switch**: Blocks ingestion for revoked/expired licenses
5. **Site Status Check**: Only active sites can ingest

## Error Handling

- Comprehensive error responses following API contract
- Error codes: `INVALID_SIGNATURE`, `NONCE_REUSED`, `INVALID_TIMESTAMP`, etc.
- Failed ingestion events logged with error messages
- Embedding usage logged for both success and failure

## Usage Tracking

- All embedding generation logged via `logEmbeddingUsage()`
- Tracks tokens, model, latency, success/failure
- Integrated with existing usage tracking system

## Environment Variables Required

- `OPENAI_API_KEY` - OpenAI API key for embeddings
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin operations

## Notes

1. **Page Endpoint**: The `GET /page/{id}` endpoint may need to be implemented in the WordPress plugin if it doesn't exist yet.

2. **pgvector Format**: Embeddings are stored as arrays directly - Supabase handles the conversion to pgvector format.

3. **Chunking**: Default chunk size is 1000 characters with 200 character overlap. Adjust in `generateEmbeddingsWithChunking()` if needed.

4. **Batch Processing**: Product batch ingestion uses concurrency limit of 5 to avoid overwhelming the system.

5. **Nonce Cache**: Currently in-memory. For distributed systems, consider using Redis or similar.

## Testing Recommendations

1. Test HMAC validation with valid/invalid signatures
2. Test idempotency with duplicate event_ids
3. Test ingestion for products and pages
4. Test deletion of embeddings
5. Test error handling (invalid events, missing fields, etc.)
6. Test license kill-switch behavior
7. Test batch operations

## Future Enhancements

- Redis-based nonce cache for distributed systems
- Retry mechanism for failed ingestion events
- Webhook event queue for high-volume scenarios
- Monitoring and alerting for ingestion failures
