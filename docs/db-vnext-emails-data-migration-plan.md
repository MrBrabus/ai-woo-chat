# DB vNext - Emails Table Data Migration Plan

## Overview

This document proposes a plan to migrate historical email-related events from `audit_logs` to the new `emails` table.

**Status**: PROPOSAL ONLY - NOT EXECUTED  
**Execution**: Requires explicit approval after emails table is in production

## Scope

Migrate email-related audit log entries:
- Action types: `email_sent`, `email_failed`, `email_pending`
- From: `audit_logs` table
- To: `emails` table

## Data Mapping

### Source: audit_logs
```sql
SELECT 
  id,
  site_id,
  action,  -- 'email_sent', 'email_failed', 'email_pending'
  metadata,  -- JSONB with email data
  created_at
FROM audit_logs
WHERE action IN ('email_sent', 'email_failed', 'email_pending')
```

### Target: emails
```sql
INSERT INTO emails (
  id,  -- Preserve original audit_logs.id for traceability
  site_id,
  conversation_id,
  to,
  subject,
  resend_message_id,
  status,
  error_message,
  metadata,
  created_at
)
```

### Mapping Logic

```javascript
// Pseudo-code for mapping
function mapAuditLogToEmail(auditLog) {
  const metadata = auditLog.metadata || {};
  
  return {
    id: auditLog.id,  // Preserve original ID
    site_id: auditLog.site_id,
    conversation_id: metadata.conversation_id || null,
    to: Array.isArray(metadata.to) ? metadata.to.join(',') : metadata.to || '',
    subject: metadata.subject || '',
    resend_message_id: metadata.resend_message_id || null,
    status: metadata.status || mapActionToStatus(auditLog.action),
    error_message: metadata.error_message || null,
    metadata: {
      ...metadata,
      migrated_from: 'audit_logs',
      migrated_at: new Date().toISOString(),
      original_action: auditLog.action,
    },
    created_at: auditLog.created_at,
  };
}

function mapActionToStatus(action) {
  switch (action) {
    case 'email_sent': return 'sent';
    case 'email_failed': return 'failed';
    case 'email_pending': return 'pending';
    default: return 'pending';
  }
}
```

## Migration Strategy

### Option 1: Full Migration (Recommended)

**Process**:
1. Run migration script to copy all email-related audit_logs to emails table
2. Verify data integrity
3. Mark migrated records in audit_logs (optional: add `migrated_to_emails` flag)
4. Keep audit_logs entries for historical reference (don't delete)

**Pros**:
- Complete historical data in emails table
- Easier queries (single table)
- Better performance

**Cons**:
- Larger migration
- Potential duplicates if emails table already has some entries

### Option 2: Incremental Migration

**Process**:
1. Migrate only records older than a certain date (e.g., before emails table creation)
2. New records go directly to emails table
3. Keep old records in audit_logs

**Pros**:
- Smaller initial migration
- Lower risk

**Cons**:
- Data split across two tables
- More complex queries if historical data needed

### Option 3: No Migration (Current)

**Process**:
- Keep historical data in audit_logs
- Only new emails go to emails table
- Application queries both tables if needed

**Pros**:
- No migration risk
- Historical data preserved

**Cons**:
- Data split across two tables
- More complex application logic

## Recommended Approach: Option 1 (Full Migration)

### Migration Script

```sql
-- Migration script (DO NOT EXECUTE - PROPOSAL ONLY)
-- Run this in staging first, then production after approval

BEGIN;

-- Insert email records from audit_logs
INSERT INTO emails (
  id,
  site_id,
  conversation_id,
  to,
  subject,
  resend_message_id,
  status,
  error_message,
  metadata,
  created_at
)
SELECT 
  al.id,
  al.site_id,
  (al.metadata->>'conversation_id')::UUID AS conversation_id,
  CASE 
    WHEN jsonb_typeof(al.metadata->'to') = 'array' 
    THEN array_to_string(ARRAY(SELECT jsonb_array_elements_text(al.metadata->'to')), ',')
    ELSE al.metadata->>'to'
  END AS to,
  al.metadata->>'subject' AS subject,
  al.metadata->>'resend_message_id' AS resend_message_id,
  CASE 
    WHEN al.metadata->>'status' IS NOT NULL THEN al.metadata->>'status'
    WHEN al.action = 'email_sent' THEN 'sent'
    WHEN al.action = 'email_failed' THEN 'failed'
    WHEN al.action = 'email_pending' THEN 'pending'
    ELSE 'pending'
  END AS status,
  al.metadata->>'error_message' AS error_message,
  jsonb_build_object(
    'type', 'email',
    'migrated_from', 'audit_logs',
    'migrated_at', NOW(),
    'original_action', al.action
  ) || COALESCE(al.metadata, '{}'::jsonb) AS metadata,
  al.created_at
FROM audit_logs al
WHERE al.action IN ('email_sent', 'email_failed', 'email_pending')
  AND NOT EXISTS (
    SELECT 1 FROM emails e WHERE e.id = al.id
  )
ON CONFLICT (id) DO NOTHING;

-- Optional: Mark migrated records in audit_logs
UPDATE audit_logs
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'migrated_to_emails', true,
  'migrated_at', NOW()
)
WHERE action IN ('email_sent', 'email_failed', 'email_pending')
  AND EXISTS (SELECT 1 FROM emails e WHERE e.id = audit_logs.id);

COMMIT;
```

## Verification Queries

After migration, verify data integrity:

```sql
-- Count comparison
SELECT 
  (SELECT COUNT(*) FROM audit_logs WHERE action IN ('email_sent', 'email_failed', 'email_pending')) AS audit_logs_count,
  (SELECT COUNT(*) FROM emails) AS emails_count;

-- Sample verification
SELECT 
  e.id,
  e.site_id,
  e.status,
  e.created_at,
  al.action,
  al.created_at AS audit_created_at
FROM emails e
LEFT JOIN audit_logs al ON al.id = e.id
WHERE e.metadata->>'migrated_from' = 'audit_logs'
LIMIT 10;

-- Check for missing data
SELECT 
  al.id,
  al.site_id,
  al.action,
  al.created_at
FROM audit_logs al
WHERE al.action IN ('email_sent', 'email_failed', 'email_pending')
  AND NOT EXISTS (SELECT 1 FROM emails e WHERE e.id = al.id)
LIMIT 10;
```

## Rollback Plan

If migration causes issues:

1. **Delete migrated records**:
   ```sql
   DELETE FROM emails WHERE metadata->>'migrated_from' = 'audit_logs';
   ```

2. **Revert audit_logs metadata**:
   ```sql
   UPDATE audit_logs
   SET metadata = metadata - 'migrated_to_emails' - 'migrated_at'
   WHERE metadata->>'migrated_to_emails' = 'true';
   ```

## Execution Checklist

Before executing migration:
- [ ] Emails table is in production and stable
- [ ] Application code is using emails table
- [ ] Backup of audit_logs table created
- [ ] Migration script tested in staging
- [ ] Verification queries prepared
- [ ] Rollback plan tested
- [ ] **Explicit approval for data migration received**
- [ ] Maintenance window scheduled (if needed)

## Timeline

**Proposed Timeline** (after emails table is in production):
1. Week 1: Test migration script in staging
2. Week 2: Review and refine migration script
3. Week 3: Execute in production (if approved)
4. Week 4: Verify and monitor

## Notes

- **DO NOT EXECUTE** this migration until:
  1. Emails table is stable in production
  2. Application is fully migrated to use emails table
  3. Explicit approval is received
- Historical data in audit_logs is safe and can remain there
- Migration is optional - not required for emails table to function
- Consider keeping audit_logs entries for full audit trail even after migration
