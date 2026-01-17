# Database Migrations

## Prerequisites

These migrations assume the following tables already exist:
- `tenants` - Tenant/organization table
- `sites` - WordPress sites table (with `tenant_id` and `license_id` columns)
- `licenses` - License table (with `status` and `plan_limits` JSONB column)
- `conversations` - Conversation table (optional, for conversation_id foreign key)

If these tables don't exist, create them first before running these migrations.

## Migration Order

Run migrations in this exact order:

1. **20240115000001_create_usage_events.sql**
   - Creates `usage_events` table for logging all OpenAI API usage

2. **20240115000002_create_usage_daily.sql**
   - Creates `usage_daily` table for daily aggregated usage statistics

3. **20240115000003_standardize_plan_limits.sql**
   - Standardizes `licenses.plan_limits` JSONB keys
   - Adds validation trigger

4. **20240115000004_add_roles_groundwork.sql**
   - Creates `user_tenants` and `platform_users` tables
   - Adds role helper functions

## Applying Migrations

### Using Supabase CLI

```bash
supabase migration up
```

### Manual Application

1. Open Supabase Dashboard → SQL Editor
2. Run each migration file in order
3. Verify each migration completes successfully before proceeding

## Verification

After applying all migrations, verify:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('usage_events', 'usage_daily', 'user_tenants', 'platform_users');

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('usage_events', 'usage_daily', 'user_tenants', 'platform_users');

-- Check plan_limits structure
SELECT id, plan_limits FROM licenses LIMIT 1;
```

## Rollback

To rollback, you can manually drop the tables (in reverse order):

```sql
DROP TABLE IF EXISTS platform_users CASCADE;
DROP TABLE IF EXISTS user_tenants CASCADE;
DROP TRIGGER IF EXISTS trigger_validate_plan_limits ON licenses;
DROP FUNCTION IF EXISTS validate_plan_limits();
DROP TABLE IF EXISTS usage_daily CASCADE;
DROP TABLE IF EXISTS usage_events CASCADE;
```
