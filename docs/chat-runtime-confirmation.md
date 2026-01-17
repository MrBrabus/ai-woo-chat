# Chat Runtime Implementation - Explicit Confirmation

## Origin/CORS

### ✅ Allowlist-based per site/tenant
- **Implementation**: `src/middleware/runtime-validation.ts`
- **Validation**: Origin is checked against `site.allowed_origins` array (exact match, normalized)
- **No wildcards**: `"*"` is never allowed
- **No reflection**: Origin is validated before any CORS headers are set

### ✅ Missing Origin handling
- **If Origin is missing**: Returns `403 Forbidden` with error code `MISSING_ORIGIN`
- **No CORS headers**: Invalid/missing origins get no CORS headers

### ✅ CORS headers format
- **Access-Control-Allow-Origin**: Set to validated origin (not `*`)
- **Access-Control-Allow-Credentials**: `true`
- **Vary**: `Origin` (added in implementation)
- **Additional headers**: `Access-Control-Allow-Methods`, `Access-Control-Allow-Headers`

### ✅ OPTIONS preflight handling
- **Implementation**: Added to `withRuntimeValidation()` middleware
- **Flow**: 
  1. Validates Origin against `site.allowed_origins`
  2. Returns `204 No Content` with CORS headers if valid
  3. Returns `403 Forbidden` if invalid
- **Headers**: Includes `Access-Control-Max-Age: 86400` (24 hours)

## Session Cookies

### ⚠️ Current Implementation: JSON Response (Not Cookies)
- **visitor_id** and **conversation_id** are returned in JSON response body
- **Storage**: Client-side responsibility (localStorage, sessionStorage, or cookies)
- **No server-side cookies**: Currently not setting HTTP-only cookies

### 📝 Recommendation for Production
If cookies are needed:
- **HttpOnly**: `true` (prevents XSS)
- **Secure**: `true` (HTTPS only)
- **SameSite**: `Lax` or `Strict` (CSRF protection)
- **Path**: `/api/chat/*`
- **Domain**: SaaS domain (not WordPress domain)

**Note**: Current implementation is stateless - client manages session IDs. This is acceptable for MVP but may need cookie-based session management for production security.

## SSE Correctness

### ✅ Response format
- **Content-Type**: `text/event-stream`
- **True streaming**: Uses `ReadableStream` with `controller.enqueue()` for each chunk
- **No buffering**: Chunks are sent immediately as they arrive from OpenAI

### ✅ Heartbeat/ping
- **Implementation**: Added heartbeat every 30 seconds
- **Format**: `: heartbeat\n\n` (SSE comment)
- **Purpose**: Keeps connection alive, prevents timeout
- **Cleanup**: Cleared when stream completes or errors

### ✅ Message persistence on abort
- **User message**: Saved **before** streaming starts (always persisted)
- **Assistant message**: Saved **after** streaming completes via `fullResponsePromise`
- **On abort**: 
  - If `fullResponse.length > 0`: Partial response is saved
  - If no content: Error is logged, no message saved
- **Promise-based**: Uses `fullResponsePromise` that resolves/rejects based on stream outcome

## Live Product Verification

### ✅ HMAC-signed
- **Implementation**: `WPAPIClient.getProductLive()` uses `generateHMACHeaders()`
- **Signing**: All requests to WordPress use HMAC-SHA256 with canonical string format
- **Headers**: `X-AI-Site`, `X-AI-Ts`, `X-AI-Nonce`, `X-AI-Sign`

### ✅ Fully non-blocking
- **Implementation**: Async promise that runs in parallel with streaming
- **Timing**: Starts after 500ms delay (allows initial response chunks)
- **Streaming**: Products sent via SSE as they're verified (doesn't block text chunks)

### ✅ Failure-safe
- **Try-catch**: Each product verification wrapped in try-catch
- **Fallback**: If live endpoint fails, falls back to product card data
- **Continue on error**: Individual product failures don't stop verification of others
- **No stream interruption**: Product verification errors don't affect streaming

## Kill-Switch + Usage

### ✅ Kill-switch before OpenAI
- **Location**: `src/middleware/usage-enforcement.ts` → `enforceUsageLimits()`
- **Flow**:
  1. Extract `site_id` from request
  2. Call `validateRuntimeRequest()` (includes kill-switch check)
  3. If kill-switch active → return `403 Forbidden` **before** handler is called
  4. Handler (which calls OpenAI) is only called if validation passes
- **All endpoints**: Bootstrap, message, and events all use runtime validation

### ✅ Token usage computation/logging
- **Source**: OpenAI streaming API sends `usage` object in final chunk
- **Tracking**: Extracted from `chunk.usage` during streaming
- **Headers**: Token usage passed via response headers:
  - `X-Token-Usage-Prompt`
  - `X-Token-Usage-Completion`
  - `X-Token-Usage-Total`
- **Logging**: `usage-enforcement` middleware reads headers and logs to `usage_events` table
- **Daily aggregate**: Updates `daily_usage` table with totals and cost
- **Fallback**: If headers missing, uses estimated values (500/500/1000)

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Origin/CORS allowlist | ✅ | Per-site, no wildcards, validated before headers |
| Missing Origin | ✅ | Returns 403, no CORS headers |
| CORS headers format | ✅ | Includes Vary: Origin, credentials: true |
| OPTIONS preflight | ✅ | Handled with validation |
| Session cookies | ⚠️ | JSON response (client-managed), no server cookies |
| SSE streaming | ✅ | True streaming, no buffering |
| SSE heartbeat | ✅ | Every 30 seconds |
| Message persistence | ✅ | User before, assistant after (with abort handling) |
| Live verification HMAC | ✅ | All WP requests signed |
| Live verification non-blocking | ✅ | Async, doesn't block streaming |
| Live verification failure-safe | ✅ | Try-catch, fallback, continue on error |
| Kill-switch before OpenAI | ✅ | In middleware, before handler |
| Token usage tracking | ✅ | From OpenAI chunks, via headers, logged |

## Recommendations

1. **Session Cookies**: Consider adding HTTP-only cookies for production (security)
2. **Heartbeat Interval**: 30 seconds is standard, but may need adjustment based on proxy/CDN timeouts
3. **Token Usage**: Current implementation is correct, but consider adding retry logic if OpenAI doesn't send usage in final chunk
