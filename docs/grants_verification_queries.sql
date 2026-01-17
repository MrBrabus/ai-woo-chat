-- GRANTs Verification Queries
-- Run these in Supabase Dashboard SQL Editor to verify GRANTs are properly restricted

-- ============================================
-- 1. Verify anon has NO access to core tables
-- ============================================
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee = 'anon'
ORDER BY table_name, privilege_type;

-- Expected result: Should return NO rows (or very few if any public tables are explicitly needed)
-- anon should have NO privileges on core tables

-- ============================================
-- 2. Verify authenticated has SELECT-only on core tables
-- ============================================
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

-- Expected result: Should show ONLY SELECT privileges on:
-- - tenants, licenses, sites
-- - conversations, messages (if needed for dashboard)
-- - embeddings
-- - settings, settings_history
-- - usage_events, usage_daily
-- - user_tenants, platform_users
-- - audit_logs
-- - ingestion_events, chat_events, visitors (if needed)
-- 
-- Should NOT show: INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER

-- ============================================
-- 3. Verify no TRUNCATE/TRIGGER privileges for anon/authenticated
-- ============================================
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('TRUNCATE', 'TRIGGER')
ORDER BY table_name, grantee, privilege_type;

-- Expected result: Should return NO rows
-- anon and authenticated should NOT have TRUNCATE or TRIGGER privileges

-- ============================================
-- 4. Verify service_role has full access
-- ============================================
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;

-- Expected result: Should show ALL privileges (SELECT, INSERT, UPDATE, DELETE) on all tables
-- service_role needs full access for server-side operations

-- ============================================
-- 5. Summary: All grants for anon/authenticated
-- ============================================
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee IN ('anon','authenticated')
ORDER BY table_name, grantee, privilege_type;

-- Expected result:
-- - anon: NO rows (or minimal if any public access needed)
-- - authenticated: ONLY SELECT privileges on dashboard tables
