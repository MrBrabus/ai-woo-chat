-- Security Verification Queries
-- Run these in Supabase Dashboard SQL Editor to verify RLS security fixes

-- ============================================
-- 1. Verify RLS Policies (roles should be authenticated, not public)
-- ============================================
SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname='public'
ORDER BY tablename, policyname;

-- Expected results:
-- - All "Users can view..." policies should have roles = {authenticated}
-- - NO "Service role can manage..." policies should exist
-- - NO policies with roles = {public} should exist

-- ============================================
-- 2. Verify Table Grants (anon/authenticated should NOT have INSERT/UPDATE/DELETE)
-- ============================================
SELECT table_name, privilege_type, grantee
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee IN ('anon', 'authenticated', 'public')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, grantee, privilege_type;

-- Expected results:
-- - Should return NO rows (or very few for specific runtime tables if needed)
-- - anon should NOT have INSERT/UPDATE/DELETE on any core tables
-- - authenticated should NOT have INSERT/UPDATE/DELETE on tenant/core tables

-- ============================================
-- 3. Verify service_role has necessary permissions
-- ============================================
SELECT table_name, privilege_type, grantee
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee = 'service_role'
  AND privilege_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
ORDER BY table_name, privilege_type;

-- Expected results:
-- - service_role should have ALL privileges on all tables

-- ============================================
-- 4. Verify RLS is enabled on key tables
-- ============================================
SELECT relname, relrowsecurity
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE nspname='public'
  AND relname IN ('tenants','sites','licenses','conversations','messages','usage_events','usage_daily')
ORDER BY relname;

-- Expected results:
-- - All tables should have relrowsecurity = true
