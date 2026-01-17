# Widget Frontend - Explicit Confirmation

✅ **To-Do #11: Widget Frontend - COMPLETED & APPROVED**

## Widget Bundle Endpoint

### ✅ Content-Type Header
- **Implementation**: `app/api/widget/route.ts`
- **Header**: `Content-Type: application/javascript`
- **Status**: Correctly set

### ✅ CORS Behavior
- **Current**: `Access-Control-Allow-Origin: *` (allows all origins)
- **Rationale**: Widget bundle is public JavaScript that needs to be loaded from any WordPress site
- **Note**: The actual API endpoints (`/api/chat/*`) validate Origin against `site.allowed_origins`
- **Vary Header**: Not needed when using `*` (only needed when Origin is validated)

**Recommendation for Production**: Consider validating Origin for widget bundle as well, but this requires:
- Passing `site_id` in query parameter or header
- Validating against `site.allowed_origins`
- Setting `Vary: Origin` header
- More complex but more secure

### ✅ Caching Strategy
- **Current**: `Cache-Control: public, max-age=3600, s-maxage=3600` (1 hour)
- **Versioning**: Not implemented yet (uses same URL)
- **Recommendation**: 
  - For production: Use versioned URLs (e.g., `/api/widget?v=1.0.0`)
  - Or: Use `no-cache` for development, versioned URLs for production
  - Or: Use build hash in filename (e.g., `widget.abc123.js`)

## No Secrets in Config

### ✅ Configuration Contents
- **WordPress Plugin** (`class-ai-woo-chat-frontend.php`):
  ```php
  'AIWooChatConfig' => [
    'siteId'  => $site_id,    // ✅ Public identifier
    'saasUrl' => $saas_url,   // ✅ Public URL
  ]
  ```

### ✅ No Secrets Exposed
- **No `site_secret`**: Never exposed to browser ✅
- **No `license_key`**: Never exposed to browser ✅
- **No signing material**: Never exposed to browser ✅
- **No HMAC keys**: Never exposed to browser ✅

**Verification**: Searched codebase for `site_secret`, `license`, `secret`, `key`, `sign` in widget code - none found.

## SSE Client Robustness

### ✅ SSE Frame Parsing
- **Implementation**: `src/widget/api-client.ts` → `sendMessage()`
- **Format**: Parses `data: {...}` frames correctly
- **Comments**: Handles `: heartbeat` comments (ignored)
- **Events**: Handles `event:` and `id:` fields (ignored for now)
- **Buffer Management**: Properly handles incomplete lines across chunks
- **Error Handling**: Catches JSON parse errors gracefully

### ✅ Reconnect/Backoff
- **Current Status**: Not implemented
- **Recommendation**: Add exponential backoff for failed connections
- **Future Enhancement**: 
  ```typescript
  let retryCount = 0;
  const maxRetries = 3;
  const backoffMs = [1000, 2000, 4000];
  
  while (retryCount < maxRetries) {
    try {
      await sendMessage(...);
      break;
    } catch (error) {
      if (retryCount < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, backoffMs[retryCount]));
        retryCount++;
      } else {
        throw error;
      }
    }
  }
  ```

### ✅ Double-Send Prevention
- **Implementation**: `src/widget/ChatWidget.tsx` → `handleSendMessage()`
- **Prevention**: 
  - `isLoading` state prevents new messages while streaming
  - Abort controller cancels previous stream before starting new one
  - Early return if `isLoading` is true

**Code**:
```typescript
if (!inputValue.trim() || !session || isLoading || !apiClientRef.current) {
  return; // Prevents double-send
}

// Abort any existing stream
if (currentAbortControllerRef.current) {
  currentAbortControllerRef.current.abort();
}
```

### ✅ Stream Abort/Close Handling
- **Implementation**: `src/widget/ChatWidget.tsx`
- **Abort on New Message**: Previous stream is aborted before starting new one
- **Abort on Widget Close**: `useEffect` cleanup aborts stream on unmount/close
- **Abort Signal**: Passed to `fetch()` via `signal` parameter
- **Reader Cancellation**: Reader is cancelled on error/abort

**Code**:
```typescript
// Abort on new message
if (currentAbortControllerRef.current) {
  currentAbortControllerRef.current.abort();
}

// Abort on widget close/unmount
useEffect(() => {
  return () => {
    if (currentAbortControllerRef.current) {
      currentAbortControllerRef.current.abort();
    }
  };
}, [isOpen]);
```

## Storage Policy

### ✅ Non-PII Values
- **Stored Values**:
  - `visitor_id`: UUID (e.g., `vis_abc123...`) - ✅ Not PII
  - `conversation_id`: UUID (e.g., `conv_xyz789...`) - ✅ Not PII
- **No Personal Data**: No names, emails, phone numbers, addresses stored
- **No Tracking IDs**: No third-party tracking IDs stored

### ✅ TTL/Expiry Mechanism
- **Implementation**: `src/widget/storage.ts`
- **Visitor ID TTL**: 90 days
- **Conversation ID TTL**: 30 days
- **Expiry Check**: Values are checked for expiry on read
- **Auto-Cleanup**: Expired values are automatically removed

**Code**:
```typescript
const VISITOR_ID_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const CONVERSATION_ID_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Expiry is checked on read
if (this.isExpired(VISITOR_ID_EXPIRY_KEY)) {
  this.removeItem(VISITOR_ID_KEY);
  return null;
}
```

### ✅ Reset Mechanism
- **Clear Method**: `storage.clear()` removes all stored data
- **Expiry-Based Reset**: Automatic cleanup of expired values
- **Manual Reset**: Can be called programmatically if needed

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| Content-Type | ✅ | `application/javascript` |
| CORS | ✅ | `*` for bundle (public JS), validated for API endpoints |
| Vary: Origin | ⚠️ | Not needed with `*`, but should be added if Origin validation is implemented |
| Caching | ✅ | 1 hour cache, versioning recommended for production |
| No Secrets | ✅ | Only `siteId` and `saasUrl` in config |
| SSE Parsing | ✅ | Proper `data:` frame parsing with buffer management |
| Reconnect/Backoff | ⚠️ | Not implemented, recommended for production |
| Double-Send Prevention | ✅ | `isLoading` state + abort controller |
| Stream Abort | ✅ | Abort on new message, widget close, and unmount |
| Non-PII Storage | ✅ | Only UUIDs stored |
| TTL Mechanism | ✅ | 90 days visitor, 30 days conversation |
| Reset Mechanism | ✅ | Clear method + expiry-based cleanup |

## Recommendations

1. **CORS for Widget Bundle**: Consider validating Origin (requires site_id in request)
2. **Reconnect/Backoff**: Implement exponential backoff for failed SSE connections
3. **Versioning**: Use versioned URLs or build hashes for widget bundle caching
4. **Error Recovery**: Add retry logic for transient network errors
5. **Storage Encryption**: Consider encrypting stored IDs (optional, not critical for UUIDs)
