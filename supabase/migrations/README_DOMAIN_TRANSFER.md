# Domain Transfer Migrations

## Migration Order

Run these migrations **after** the usage tracking migrations:

1. **20240116000001_update_sites_table.sql**
   - Updates sites table with status, environment, allowed_origins, and tracking fields
   - Safe to run on existing tables (uses IF NOT EXISTS checks)

2. **20240116000002_update_licenses_table.sql**
   - Adds max_sites column
   - Updates plan_limits JSONB structure
   - Safe to run on existing tables

3. **20240116000003_create_audit_logs.sql**
   - Creates audit_logs table
   - Creates helper function log_audit_event()
   - Safe to run (creates new table)

## Prerequisites

These migrations assume:
- `sites` table exists
- `licenses` table exists
- `tenants` table exists
- `auth.users` table exists (Supabase Auth)

## Applying Migrations

### Using Supabase CLI

```bash
supabase migration up
```

### Manual Application

1. Open Supabase Dashboard → SQL Editor
2. Run each migration file in order
3. Verify each migration completes successfully

## Verification

After applying migrations:

```sql
-- Check sites table has new columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'sites' 
AND column_name IN ('status', 'environment', 'allowed_origins', 'secret_rotated_at', 'disabled_at', 'last_paired_at');

-- Check licenses table has max_sites
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'licenses' 
AND column_name = 'max_sites';

-- Check audit_logs table exists
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'audit_logs';

-- Check log_audit_event function exists
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'log_audit_event';
```

## Rollback

To rollback (in reverse order):

```sql
-- Drop audit_logs
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP FUNCTION IF EXISTS log_audit_event();

-- Remove columns from licenses (if needed)
ALTER TABLE licenses DROP COLUMN IF EXISTS max_sites;

-- Remove columns from sites (if needed)
ALTER TABLE sites DROP COLUMN IF EXISTS status;
ALTER TABLE sites DROP COLUMN IF EXISTS environment;
ALTER TABLE sites DROP COLUMN IF EXISTS allowed_origins;
ALTER TABLE sites DROP COLUMN IF EXISTS secret_rotated_at;
ALTER TABLE sites DROP COLUMN IF EXISTS disabled_at;
ALTER TABLE sites DROP COLUMN IF EXISTS last_paired_at;
```

## Notes

- Existing sites will be set to `status='active'` and `environment='production'`
- Existing sites will have `allowed_origins` populated from `site_url`
- Default `max_sites` is 2 (for prod + staging)
- Default cooldown is 24 hours, monthly limit is 3
