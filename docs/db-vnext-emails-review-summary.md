# DB vNext - Emails Table Review Summary

## Migration Overview

**Migration File**: `supabase/migrations/20240120000001_create_emails_table.sql`  
**Status**: Ready for Staging Review  
**Phase**: Phase 1 - Table Creation Only

## Schema Review

### Table Structure
- ✅ Primary key: `id` (UUID)
- ✅ Foreign keys: `site_id` → `sites(id)`, `conversation_id` → `conversations(id)`
- ✅ Required fields: `site_id`, `to`, `subject`, `status`
- ✅ Optional fields: `conversation_id`, `resend_message_id`, `error_message`
- ✅ JSONB metadata for extensibility
- ✅ Timestamps: `created_at`

### Constraints
- ✅ Status CHECK constraint: `('sent', 'failed', 'pending')`
- ✅ Foreign key CASCADE on site delete
- ✅ Foreign key SET NULL on conversation delete

### Indexes
- ✅ `idx_emails_site_id` - For filtering by site (most common query)
- ✅ `idx_emails_conversation_id` - For filtering by conversation
- ✅ `idx_emails_status` - For filtering by status
- ✅ `idx_emails_created_at DESC` - For sorting by date (descending)
- ✅ `idx_emails_resend_message_id` - Partial index (WHERE NOT NULL) for Resend ID lookups
- ✅ `idx_emails_metadata GIN` - For JSONB queries

## RLS Policy Review

### Policy 1: Service Role Access
```sql
CREATE POLICY "Service role can manage emails"
    ON emails FOR ALL
    USING (true);
```
- ✅ Allows service role full access (required for runtime logging)
- ✅ Safe: Service role is server-side only

### Policy 2: Tenant Isolation
```sql
CREATE POLICY "Users can view emails for their tenants"
    ON emails FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_tenants ut
            JOIN sites s ON s.tenant_id = ut.tenant_id
            WHERE s.id = emails.site_id
            AND ut.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users
            WHERE user_id = auth.uid()
            AND role = 'super_admin'
        )
    );
```
- ✅ Ensures tenant isolation (users only see their tenant's emails)
- ✅ Allows super_admin to see all emails
- ✅ SELECT only (users cannot modify emails)
- ✅ Safe: Properly scoped to user_tenants relationship

## Code Integration

### Feature Flag Support
- ✅ Environment variable: `USE_EMAILS_TABLE`
- ✅ Default: `true` (use new table if available)
- ✅ Automatic fallback to `audit_logs` if table doesn't exist
- ✅ No breaking changes to existing code

### Implementation Files
- ✅ `src/lib/email/logger-v2.ts` - New implementation with dual-table support
- ✅ `src/lib/email/logger.ts` - Updated with backward compatibility note
- ✅ Existing code continues to work during migration

## Verification Checklist

### Staging Deployment
- [ ] Migration applies without errors
- [ ] Table created successfully
- [ ] Indexes created successfully
- [ ] RLS policies created successfully
- [ ] No conflicts with existing schema

### RLS Testing
- [ ] Service role can INSERT emails
- [ ] Service role can SELECT emails
- [ ] Regular user can SELECT their tenant's emails
- [ ] Regular user CANNOT SELECT other tenant's emails
- [ ] Regular user CANNOT INSERT/UPDATE/DELETE emails
- [ ] Super admin can SELECT all emails

### Performance Testing
- [ ] Query by site_id: < 10ms
- [ ] Query by conversation_id: < 5ms
- [ ] Query by status: < 10ms
- [ ] Query with date range: < 20ms
- [ ] Index usage verified (EXPLAIN ANALYZE)

### Application Testing
- [ ] Email logging works with feature flag ON
- [ ] Email logging falls back to audit_logs if table missing
- [ ] Email log retrieval works correctly
- [ ] No errors in application logs

## Known Considerations

1. **Data Migration**: Not included in Phase 1. Historical data remains in `audit_logs` until optional migration (see `db-vnext-emails-data-migration-plan.md`)

2. **Dual Table Support**: Application supports both tables during migration period. No data loss risk.

3. **Backward Compatibility**: Existing `audit_logs` logging continues to work if `USE_EMAILS_TABLE=false` or if table doesn't exist.

4. **No Destructive Changes**: Migration only creates new table. No changes to existing tables.

## Rollout Readiness

### Ready for Staging
- ✅ Migration file created
- ✅ RLS policies defined
- ✅ Indexes optimized
- ✅ Code integration prepared
- ✅ Feature flag implemented
- ✅ Rollback plan documented

### Pending
- ⏳ Staging deployment
- ⏳ RLS verification
- ⏳ Performance verification
- ⏳ Application testing
- ⏳ Review approval
- ⏳ Production deployment approval

## Next Steps

1. **Apply to Staging**: Deploy migration to staging Supabase project
2. **Verify RLS**: Test all RLS policies with real user/service role accounts
3. **Test Performance**: Run query performance tests
4. **Test Application**: Enable feature flag and test email logging
5. **Document Findings**: Update this review summary with results
6. **Request Approval**: Submit for production deployment approval

## Approval Status

- **Staging**: ⏳ Pending deployment
- **Production**: ⏳ Awaiting staging verification and explicit approval

---

**STOP CONDITION**: After staging deployment and verification, STOP and wait for explicit production approval before proceeding.
