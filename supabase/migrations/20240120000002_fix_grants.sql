-- Fix GRANTs to enforce strict security
-- 1. Revoke ALL privileges from anon and authenticated
-- 2. Grant back minimal SELECT-only for authenticated (dashboard read)
-- 3. Ensure all writes are server-side using service_role

-- ============================================
-- 1. REVOKE ALL privileges from anon and authenticated
-- ============================================

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM authenticated;

-- ============================================
-- 2. GRANT SELECT-only to authenticated for dashboard read access
-- Only on tables that authenticated users need to view via RLS policies
-- ============================================

-- Core tenant tables (dashboard read)
GRANT SELECT ON tenants TO authenticated;
GRANT SELECT ON licenses TO authenticated;
GRANT SELECT ON sites TO authenticated;

-- Chat tables (dashboard read - if needed)
-- Note: conversations and messages might be needed for dashboard analytics
GRANT SELECT ON conversations TO authenticated;
GRANT SELECT ON messages TO authenticated;

-- Embeddings (dashboard read)
GRANT SELECT ON embeddings TO authenticated;

-- Settings (dashboard read)
GRANT SELECT ON settings TO authenticated;
GRANT SELECT ON settings_history TO authenticated;

-- Usage tracking (dashboard read)
GRANT SELECT ON usage_events TO authenticated;
GRANT SELECT ON usage_daily TO authenticated;

-- Roles (dashboard read)
GRANT SELECT ON user_tenants TO authenticated;
GRANT SELECT ON platform_users TO authenticated;

-- Audit logs (dashboard read)
GRANT SELECT ON audit_logs TO authenticated;

-- Ingestion events (dashboard read - if needed)
GRANT SELECT ON ingestion_events TO authenticated;

-- Chat events (dashboard read - if needed)
GRANT SELECT ON chat_events TO authenticated;

-- Visitors (dashboard read - if needed)
GRANT SELECT ON visitors TO authenticated;

-- ============================================
-- 3. Ensure anon has NO access to core tables
-- (anon should have no grants - already revoked above)
-- ============================================

-- Explicitly revoke any remaining privileges (defense in depth)
REVOKE ALL ON tenants FROM anon;
REVOKE ALL ON licenses FROM anon;
REVOKE ALL ON sites FROM anon;
REVOKE ALL ON visitors FROM anon;
REVOKE ALL ON conversations FROM anon;
REVOKE ALL ON messages FROM anon;
REVOKE ALL ON embeddings FROM anon;
REVOKE ALL ON ingestion_events FROM anon;
REVOKE ALL ON settings FROM anon;
REVOKE ALL ON settings_history FROM anon;
REVOKE ALL ON usage_events FROM anon;
REVOKE ALL ON usage_daily FROM anon;
REVOKE ALL ON user_tenants FROM anon;
REVOKE ALL ON platform_users FROM anon;
REVOKE ALL ON audit_logs FROM anon;
REVOKE ALL ON chat_events FROM anon;

-- ============================================
-- 4. Ensure authenticated has NO write privileges
-- (only SELECT granted above)
-- ============================================

-- Explicitly revoke write privileges (defense in depth)
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON tenants FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON licenses FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON sites FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON visitors FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON conversations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON messages FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON embeddings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON ingestion_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON settings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON settings_history FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON usage_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON usage_daily FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON user_tenants FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON platform_users FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER ON chat_events FROM authenticated;

-- ============================================
-- 5. Ensure service_role has full access for server-side operations
-- ============================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- ============================================
-- 6. Set default privileges to prevent future grants
-- ============================================

-- Prevent future tables from getting grants to anon/authenticated by default
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  REVOKE ALL ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  REVOKE ALL ON TABLES FROM authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT ALL ON TABLES TO service_role;
