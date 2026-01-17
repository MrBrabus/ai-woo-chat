-- Update RLS policies to use user_tenants and platform_users (after they are created)
-- This migration updates the temporary policies created earlier

-- Drop and recreate tenants policy
DROP POLICY IF EXISTS "Users can view their tenants" ON tenants;
CREATE POLICY "Users can view their tenants"
    ON tenants FOR SELECT
    USING (
        id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Drop and recreate licenses policy
DROP POLICY IF EXISTS "Users can view licenses for their tenants" ON licenses;
CREATE POLICY "Users can view licenses for their tenants"
    ON licenses FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Drop and recreate sites policy
DROP POLICY IF EXISTS "Users can view sites for their tenants" ON sites;
CREATE POLICY "Users can view sites for their tenants"
    ON sites FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Drop and recreate embeddings policy
DROP POLICY IF EXISTS "Users can view embeddings for their tenants" ON embeddings;
CREATE POLICY "Users can view embeddings for their tenants"
    ON embeddings FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Drop and recreate settings policies
DROP POLICY IF EXISTS "Users can view settings for their tenants" ON settings;
CREATE POLICY "Users can view settings for their tenants"
    ON settings FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "Users can view settings_history for their tenants" ON settings_history;
CREATE POLICY "Users can view settings_history for their tenants"
    ON settings_history FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

-- Drop and recreate usage tables policies
DROP POLICY IF EXISTS "Users can view usage_events for their tenant" ON usage_events;
CREATE POLICY "Users can view usage_events for their tenant"
    ON usage_events FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

DROP POLICY IF EXISTS "Users can view usage_daily for their tenant" ON usage_daily;
CREATE POLICY "Users can view usage_daily for their tenant"
    ON usage_daily FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );
