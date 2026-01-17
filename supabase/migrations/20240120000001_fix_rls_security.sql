-- Fix critical RLS security issues
-- 1. Update all "Users can view..." policies to use 'authenticated' role instead of 'public'
-- 2. Remove "Service role can manage..." policies (service_role bypasses RLS server-side)
-- 3. Ensure proper role assignments

-- ============================================
-- 1. Remove dangerous "Service role can manage..." policies
-- Service role bypasses RLS, so these policies are unnecessary and dangerous
-- ============================================

DROP POLICY IF EXISTS "Service role can manage tenants" ON tenants;
DROP POLICY IF EXISTS "Service role can manage licenses" ON licenses;
DROP POLICY IF EXISTS "Service role can manage sites" ON sites;
DROP POLICY IF EXISTS "Service role can manage visitors" ON visitors;
DROP POLICY IF EXISTS "Service role can manage conversations" ON conversations;
DROP POLICY IF EXISTS "Service role can manage messages" ON messages;
DROP POLICY IF EXISTS "Service role can manage embeddings" ON embeddings;
DROP POLICY IF EXISTS "Service role can manage ingestion_events" ON ingestion_events;
DROP POLICY IF EXISTS "Service role can manage settings" ON settings;
DROP POLICY IF EXISTS "Service role can manage settings_history" ON settings_history;
DROP POLICY IF EXISTS "Service role can manage usage_events" ON usage_events;
DROP POLICY IF EXISTS "Service role can manage usage_daily" ON usage_daily;
DROP POLICY IF EXISTS "Service role can manage user_tenants" ON user_tenants;
DROP POLICY IF EXISTS "Service role can manage platform_users" ON platform_users;
DROP POLICY IF EXISTS "Service role can manage audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "Service role can manage chat_events" ON chat_events;

-- ============================================
-- 2. Update "Users can view..." policies to use 'authenticated' role
-- ============================================

-- Tenants
DROP POLICY IF EXISTS "Users can view their tenants" ON tenants;
CREATE POLICY "Users can view their tenants"
    ON tenants FOR SELECT
    TO authenticated
    USING (
        id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Licenses
DROP POLICY IF EXISTS "Users can view licenses for their tenants" ON licenses;
CREATE POLICY "Users can view licenses for their tenants"
    ON licenses FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Sites
DROP POLICY IF EXISTS "Users can view sites for their tenants" ON sites;
CREATE POLICY "Users can view sites for their tenants"
    ON sites FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Embeddings
DROP POLICY IF EXISTS "Users can view embeddings for their tenants" ON embeddings;
CREATE POLICY "Users can view embeddings for their tenants"
    ON embeddings FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Settings
DROP POLICY IF EXISTS "Users can view settings for their tenants" ON settings;
CREATE POLICY "Users can view settings for their tenants"
    ON settings FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Settings History
DROP POLICY IF EXISTS "Users can view settings_history for their tenants" ON settings_history;
CREATE POLICY "Users can view settings_history for their tenants"
    ON settings_history FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Usage Events
DROP POLICY IF EXISTS "Users can view usage_events for their tenant" ON usage_events;
CREATE POLICY "Users can view usage_events for their tenant"
    ON usage_events FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Usage Daily
DROP POLICY IF EXISTS "Users can view usage_daily for their tenant" ON usage_daily;
CREATE POLICY "Users can view usage_daily for their tenant"
    ON usage_daily FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- User Tenants
DROP POLICY IF EXISTS "Users can view their own tenant roles" ON user_tenants;
CREATE POLICY "Users can view their own tenant roles"
    ON user_tenants FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Platform Users
DROP POLICY IF EXISTS "Users can view their own platform role" ON platform_users;
CREATE POLICY "Users can view their own platform role"
    ON platform_users FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Audit Logs
DROP POLICY IF EXISTS "Users can view audit_logs for their tenant" ON audit_logs;
CREATE POLICY "Users can view audit_logs for their tenant"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- ============================================
-- 3. Runtime tables (visitors, conversations, messages, chat_events)
-- These need service role access for runtime, but should NOT allow public/anon
-- Since service_role bypasses RLS, we don't need policies for it
-- But we should ensure no public/anon access
-- ============================================

-- These tables are used by runtime endpoints (service role only)
-- No user-level policies needed - service role bypasses RLS
-- But ensure RLS is enabled to block any accidental public access

-- ============================================
-- 4. Revoke dangerous grants from anon/authenticated
-- ============================================

-- Revoke INSERT/UPDATE/DELETE from anon on all core tables
REVOKE INSERT, UPDATE, DELETE ON tenants FROM anon;
REVOKE INSERT, UPDATE, DELETE ON licenses FROM anon;
REVOKE INSERT, UPDATE, DELETE ON sites FROM anon;
REVOKE INSERT, UPDATE, DELETE ON visitors FROM anon;
REVOKE INSERT, UPDATE, DELETE ON conversations FROM anon;
REVOKE INSERT, UPDATE, DELETE ON messages FROM anon;
REVOKE INSERT, UPDATE, DELETE ON embeddings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON ingestion_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON settings FROM anon;
REVOKE INSERT, UPDATE, DELETE ON settings_history FROM anon;
REVOKE INSERT, UPDATE, DELETE ON usage_events FROM anon;
REVOKE INSERT, UPDATE, DELETE ON usage_daily FROM anon;
REVOKE INSERT, UPDATE, DELETE ON user_tenants FROM anon;
REVOKE INSERT, UPDATE, DELETE ON platform_users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON chat_events FROM anon;

-- Revoke INSERT/UPDATE/DELETE from authenticated on core tenant tables
-- (authenticated users should only SELECT via RLS policies)
REVOKE INSERT, UPDATE, DELETE ON tenants FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON licenses FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON sites FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON embeddings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON settings FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON settings_history FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON usage_events FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON usage_daily FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM authenticated;

-- Note: Runtime tables (visitors, conversations, messages, chat_events) 
-- are managed by service role only, so no grants needed for anon/authenticated

-- ============================================
-- 5. Ensure service_role has necessary permissions
-- (service_role should have full access via bypass, but explicit grants are good practice)
-- ============================================

-- Grant all permissions to service_role (it bypasses RLS anyway, but explicit is better)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
