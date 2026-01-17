# Usage Tracking & Cost Control Implementation

This document describes the MVP implementation of usage tracking, cost control, and super admin groundwork.

## Database Schema

### Tables Created

#### `usage_events`
Logs all OpenAI API usage events (chat and embedding requests).

**Fields:**
- `id` (UUID, PK)
- `tenant_id` (UUID, FK to tenants)
- `site_id` (UUID, FK to sites)
- `conversation_id` (UUID, FK to conversations, nullable)
- `type` (ENUM: 'chat' | 'embedding')
- `model` (TEXT) - OpenAI model used
- `prompt_tokens` (INTEGER)
- `completion_tokens` (INTEGER)
- `total_tokens` (INTEGER)
- `latency_ms` (INTEGER, nullable)
- `success` (BOOLEAN)
- `error_code` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)

**RLS Policies:**
- Users can view usage_events for their tenant
- Service role can insert/update (for server-side logging)

#### `usage_daily`
Daily aggregated usage statistics per site for plan limit enforcement.

**Fields:**
- `date` (DATE)
- `tenant_id` (UUID, FK to tenants)
- `site_id` (UUID, FK to sites)
- `chat_requests` (INTEGER)
- `embedding_requests` (INTEGER)
- `total_tokens` (BIGINT)
- `estimated_cost` (NUMERIC)
- `updated_at` (TIMESTAMPTZ)
- Primary Key: `(date, site_id)`

**RLS Policies:**
- Users can view usage_daily for their tenant
- Service role can insert/update (for server-side aggregation)

#### `licenses.plan_limits` (Standardized)
JSONB object with standardized keys:
- `max_tokens_per_day` (number)
- `max_chat_requests_per_day` (number)
- `max_embedding_tokens_per_day` (number)

A trigger ensures these keys always exist with defaults if missing.

### Roles Groundwork

#### `user_tenants`
Maps users to tenants with their role (owner/admin/support).

**Fields:**
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users)
- `tenant_id` (UUID, FK to tenants)
- `role` (ENUM: 'owner' | 'admin' | 'support')
- `created_at`, `updated_at` (TIMESTAMPTZ)
- Unique constraint: `(user_id, tenant_id)`

#### `platform_users`
Platform-level users with super_admin role (bypasses tenant isolation).

**Fields:**
- `id` (UUID, PK)
- `user_id` (UUID, FK to auth.users, unique)
- `role` (ENUM: 'super_admin')
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Helper Functions:**
- `is_super_admin(user_id)` - Checks if user has super_admin role
- `get_user_tenant_role(user_id, tenant_id)` - Gets user's role for a tenant

**RLS Policies:**
- Users can view their own roles
- Service role can manage all roles (for admin APIs)

## Runtime Enforcement

### Chat Message Endpoint (`/api/chat/message`)

The endpoint is wrapped with `withUsageEnforcement` middleware that:

1. **Validates site exists** - Returns 404 if site not found
2. **Checks license status** - Returns 403 if license is not 'active'
3. **Checks usage limits** - Compares current daily usage against plan_limits:
   - `max_chat_requests_per_day`
   - `max_tokens_per_day`
   - Returns 403 with graceful error if limits exceeded (no streaming)
4. **Logs usage** - After successful response:
   - Inserts into `usage_events`
   - Updates `usage_daily` aggregate
   - Calculates estimated cost

**Error Response (Limit Exceeded):**
```json
{
  "error": {
    "code": "USAGE_LIMIT_EXCEEDED",
    "message": "Daily usage limit reached",
    "details": {
      "current_usage": {
        "chat_requests": 1000,
        "embedding_requests": 50,
        "total_tokens": 500000
      },
      "limits": {
        "max_tokens_per_day": 1000000,
        "max_chat_requests_per_day": 1000,
        "max_embedding_tokens_per_day": 100000
      }
    }
  }
}
```

### Embedding Generation (Ingestion)

Embedding usage is logged during ingestion webhook processing:

1. **After generating embeddings** - Logs to `usage_events`
2. **Updates daily aggregate** - Increments `embedding_requests` and `total_tokens`
3. **Calculates cost** - Based on embedding model pricing

**Integration Example:**
```typescript
import { logEmbeddingUsage } from '@/lib/embedding-usage';

// After generating embeddings
await logEmbeddingUsage({
  site_id,
  tenant_id,
  model: 'text-embedding-3-small',
  prompt_tokens: tokens,
  completion_tokens: 0,
  total_tokens: tokens,
  latency_ms,
  success: true,
});
```

## Cost Calculation

Cost is calculated based on OpenAI model pricing (per 1K tokens):

- **GPT-4**: $0.03 prompt / $0.06 completion
- **GPT-4 Turbo**: $0.01 prompt / $0.03 completion
- **GPT-4o**: $0.005 prompt / $0.015 completion
- **GPT-3.5 Turbo**: $0.0005 prompt / $0.0015 completion
- **Embedding models**: Varies by model

Pricing is defined in `src/lib/usage-tracking.ts` and can be updated as needed.

## Super Admin Access

Super admin access is implemented via:

1. **Platform-level role** - Stored in `platform_users` table
2. **Server-side APIs** - Use service role key to bypass RLS
3. **No client-side bypass** - RLS policies remain enforced for normal users

**To create a super admin:**
```sql
INSERT INTO platform_users (user_id, role)
VALUES ('<user_uuid>', 'super_admin');
```

**To check if user is super admin (server-side):**
```typescript
const { data } = await supabaseAdmin
  .rpc('is_super_admin', { check_user_id: userId });
```

## Environment Variables Required

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Migration Order

Run migrations in this order:
1. `20240115000001_create_usage_events.sql`
2. `20240115000002_create_usage_daily.sql`
3. `20240115000003_standardize_plan_limits.sql`
4. `20240115000004_add_roles_groundwork.sql`

## Next Steps (Phase 2 - Not in MVP)

- Full super-admin UI dashboard pages
- Advanced alerting/site_health tables
- Detailed rate limit buckets
- Real-time usage monitoring
- Cost analytics and reporting

## Notes

- Usage logging should not break the main flow - errors are logged but don't throw
- Token counts are estimated in MVP - in production, capture actual counts from OpenAI responses
- Daily aggregates are updated incrementally using upsert operations
- All RLS policies maintain tenant isolation for normal users
