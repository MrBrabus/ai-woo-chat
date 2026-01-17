# Chat Runtime Implementation

## Overview

To-Do #10: Chat Runtime endpoints have been fully implemented. This provides complete chat functionality with RAG, live product verification, session management, and CORS validation.

## Components

### 1. Session Management (`src/lib/chat/session.ts`)

**Functions:**
- `getOrCreateVisitor()` - Get or create visitor record
- `getOrCreateConversation()` - Get or create conversation record
- `getConversationCount()` - Get conversation count for visitor
- `bootstrapSession()` - Complete bootstrap flow

**Features:**
- Visitor tracking with first_seen_at and last_seen_at
- Conversation management with message_count
- Welcome back detection for returning visitors
- Session info with conversation count

### 2. Message Handler (`src/lib/chat/message-handler.ts`)

**Functions:**
- `getConversationHistory()` - Get recent messages for context
- `verifyProducts()` - Verify products with live data from WordPress
- `processChatMessage()` - Complete message processing pipeline
- `saveMessage()` - Persist messages to database

**Features:**
- RAG pipeline integration
- OpenAI streaming with SSE
- Live product verification (async, non-blocking)
- Conversation history for context
- Message persistence with evidence
- Token usage tracking

### 3. Bootstrap Endpoint (`src/api/chat/bootstrap/route.ts`)

**Endpoint**: `POST /api/chat/bootstrap`

**Features:**
- Session initialization
- Visitor/conversation creation or retrieval
- Welcome back detection
- CORS validation (via runtime-validation middleware)
- License kill-switch check

**Response:**
```json
{
  "visitor_id": "vis_...",
  "conversation_id": "conv_...",
  "welcome_back": false,
  "session": {
    "first_seen_at": "...",
    "last_seen_at": "...",
    "conversation_count": 3
  }
}
```

### 4. Message Endpoint (`src/api/chat/message/route.ts`)

**Endpoint**: `POST /api/chat/message`

**Features:**
- SSE streaming response
- RAG pipeline for context retrieval
- OpenAI streaming integration
- Live product verification
- Message persistence (user + assistant)
- Evidence tracking for citations
- Token usage tracking
- CORS validation (via usage-enforcement middleware)
- License kill-switch check

**SSE Events:**
- `chunk`: Text content chunks
- `product`: Product recommendations with live data
- `done`: Stream complete

**Flow:**
1. Validate request (visitor/conversation exist)
2. Save user message
3. Run RAG pipeline (retrieve context)
4. Get conversation history
5. Build OpenAI messages with RAG context
6. Stream OpenAI response
7. Verify products (async, non-blocking)
8. Save assistant message with evidence
9. Return SSE stream

### 5. Events Endpoint (`src/api/chat/events/route.ts`)

**Endpoint**: `POST /api/chat/events`

**Features:**
- Event logging (view, click, add_to_cart)
- Visitor/conversation validation
- CORS validation (via runtime-validation middleware)
- License kill-switch check

**Event Types:**
- `view`: Product page viewed
- `click`: Link clicked
- `add_to_cart`: Product added to cart

### 6. CORS Origin Validation

**Implementation**: `src/middleware/runtime-validation.ts`

**Features:**
- Validates Origin header against `site.allowed_origins`
- Exact match only (no wildcards)
- Returns 403 Forbidden if invalid
- Adds CORS headers only for valid origins
- Never allows "*" wildcard

### 7. Live Product Verification

**Implementation**: `src/lib/chat/message-handler.ts` → `verifyProducts()`

**Features:**
- Fetches live product data from WordPress API
- Uses `getProductLive()` for current prices/stock
- Falls back to product card if live endpoint unavailable
- Async, non-blocking (doesn't delay streaming)
- Sends products via SSE as they're verified

**WordPress API Client:**
- `getProductLive(id)` - Live product data endpoint
- HMAC-signed requests
- Returns current price, stock, variations

## Database Integration

### Tables Used:
- `visitors` - Visitor tracking
- `conversations` - Conversation management
- `messages` - Message storage with evidence
- `chat_events` - User interaction events

### Message Storage:
- User messages: `role='user'`, `content_text` only
- Assistant messages: `role='assistant'`, `content_text` + `content_json` (with evidence)
- Token usage stored in `token_usage` JSONB column
- Evidence stored in `content_json.evidence`

## RAG Pipeline Integration

**Flow:**
1. User message received
2. `runRAGPipeline()` called with query text
3. Retrieval: pgvector similarity search
4. Context building: deduplication, limits
5. Prompt assembly: system + context + user message
6. OpenAI streaming with context
7. Evidence attached to assistant message

**Evidence Format:**
```json
{
  "sourceType": "product",
  "sourceId": "123",
  "chunkIds": ["..."],
  "score": 0.85,
  "title": "Product Title",
  "url": "https://..."
}
```

## Security

1. **CORS Validation**: All endpoints validate Origin header
2. **License Kill-Switch**: Blocks requests for revoked/expired licenses
3. **Site Status Check**: Only active sites can use chat
4. **Visitor/Conversation Validation**: Ensures valid session before processing
5. **Usage Limits**: Enforced via usage-enforcement middleware

## Usage Tracking

**Implementation**: `src/middleware/usage-enforcement.ts`

**Features:**
- Pre-request limit check (estimated tokens)
- Post-request usage logging (actual tokens from headers)
- Token usage passed via response headers:
  - `X-Token-Usage-Prompt`
  - `X-Token-Usage-Completion`
  - `X-Token-Usage-Total`
- Daily aggregate updates
- Cost calculation

## Error Handling

- Comprehensive error responses following API contract
- Error codes: `VISITOR_NOT_FOUND`, `CONVERSATION_NOT_FOUND`, etc.
- Graceful degradation (fallback to product card if live data unavailable)
- Streaming errors sent via SSE

## Notes

1. **Token Usage**: OpenAI streaming API sends usage in final chunk. We track it and pass via headers to usage-enforcement middleware.

2. **Product Verification**: Async and non-blocking. Products are verified in background and sent via SSE as they're ready.

3. **Message Persistence**: User message saved immediately, assistant message saved after streaming completes (via promise).

4. **Conversation History**: Last 10 messages loaded for context (configurable).

5. **Evidence**: Attached to assistant messages in `content_json.evidence` for dashboard display (To-Do #13).

6. **CORS Headers**: Added only for valid origins. Invalid origins get 403 with no CORS headers.

## Testing Recommendations

1. Test bootstrap with new/returning visitors
2. Test message endpoint with RAG pipeline
3. Test product verification (live data vs fallback)
4. Test CORS validation (valid/invalid origins)
5. Test license kill-switch behavior
6. Test usage limit enforcement
7. Test SSE streaming (chunks, products, done)
8. Test error handling (missing visitor/conversation)
9. Test conversation history loading
10. Test evidence attachment to messages
