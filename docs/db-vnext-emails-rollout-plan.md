# DB vNext - Emails Table Rollout Plan

## Overview

This document outlines the rollout plan for migrating from `audit_logs`-based email logging to a dedicated `emails` table.

**Status**: Phase 1 - Staging Only  
**Target**: Production rollout after review and approval

## Migration File

- **File**: `supabase/migrations/20240120000001_create_emails_table.sql`
- **Status**: Ready for staging
- **Review Required**: Yes

## Rollout Phases

### Phase 1: Staging Deployment ✅ (Current)

**Actions**:
1. ✅ Create migration file
2. ✅ Add RLS policies
3. ✅ Add indexes
4. ⏳ Apply to staging Supabase project
5. ⏳ Verify RLS correctness
6. ⏳ Verify query performance
7. ⏳ Review and document findings

**Verification Checklist**:
- [ ] Migration applies successfully
- [ ] RLS policies work correctly (service role can write, users can read their tenant's emails)
- [ ] Indexes improve query performance
- [ ] No breaking changes to existing functionality
- [ ] Application code works with feature flag

### Phase 2: Code Update (Staging)

**Actions**:
1. Update `src/lib/email/logger.ts` to use new `logger-v2.ts` logic
2. Set `USE_EMAILS_TABLE=true` in staging environment
3. Test email logging in staging
4. Verify both read and write operations
5. Monitor for errors

**Feature Flag**:
- Environment variable: `USE_EMAILS_TABLE`
- Default: `true` (use new table if available)
- Fallback: Automatically falls back to `audit_logs` if `emails` table doesn't exist

### Phase 3: Production Deployment (After Approval)

**Prerequisites**:
- ✅ Staging verification complete
- ✅ Review approved
- ✅ Explicit production deployment approval received

**Actions**:
1. Apply migration to production Supabase
2. Set `USE_EMAILS_TABLE=true` in production environment
3. Monitor for 24-48 hours
4. Verify email logging works correctly
5. Check query performance

### Phase 4: Data Migration (Optional, Future)

**Note**: This phase is documented but NOT executed yet.

See `docs/db-vnext-emails-data-migration-plan.md` for the data migration plan.

## RLS Policy Verification

### Service Role Access
- **Policy**: "Service role can manage emails"
- **Test**: Service role should be able to INSERT, SELECT, UPDATE, DELETE
- **Expected**: ✅ All operations allowed

### User Access (Tenant Isolation)
- **Policy**: "Users can view emails for their tenants"
- **Test**: 
  - User A (tenant 1) should see emails for tenant 1 sites only
  - User A should NOT see emails for tenant 2 sites
  - Super admin should see all emails
- **Expected**: ✅ Proper tenant isolation

## Performance Verification

### Indexes
- `idx_emails_site_id`: For filtering by site
- `idx_emails_conversation_id`: For filtering by conversation
- `idx_emails_status`: For filtering by status
- `idx_emails_created_at`: For sorting by date (DESC)
- `idx_emails_resend_message_id`: For looking up by Resend ID (partial index)
- `idx_emails_metadata`: GIN index for JSONB queries

### Query Performance Tests
1. **List emails for site** (most common):
   ```sql
   SELECT * FROM emails WHERE site_id = $1 ORDER BY created_at DESC LIMIT 50;
   ```
   - Expected: < 10ms with index

2. **Get emails for conversation**:
   ```sql
   SELECT * FROM emails WHERE conversation_id = $1 ORDER BY created_at DESC;
   ```
   - Expected: < 5ms with index

3. **Filter by status**:
   ```sql
   SELECT * FROM emails WHERE site_id = $1 AND status = 'failed' ORDER BY created_at DESC;
   ```
   - Expected: < 10ms with composite index usage

## Rollback Plan

If issues are discovered:

1. **Immediate Rollback**:
   - Set `USE_EMAILS_TABLE=false` in environment
   - Application automatically falls back to `audit_logs`
   - No data loss (both tables can coexist)

2. **Table Removal** (if needed):
   ```sql
   -- Only if absolutely necessary and after approval
   DROP TABLE IF EXISTS emails CASCADE;
   ```

## Monitoring

After production deployment, monitor:
- Email logging success rate
- Query performance (p95, p99 latencies)
- Error rates
- RLS policy violations (if any)

## Approval Checklist

Before production deployment:
- [ ] Staging migration applied successfully
- [ ] RLS policies verified
- [ ] Query performance verified
- [ ] Code updated and tested
- [ ] Feature flag tested
- [ ] Rollback plan documented
- [ ] Monitoring plan in place
- [ ] **Explicit production approval received**

## Notes

- The `emails` table and `audit_logs` can coexist
- Application code supports both (with feature flag)
- No data migration required initially (optional future phase)
- Historical email logs remain in `audit_logs` until data migration (if approved)
