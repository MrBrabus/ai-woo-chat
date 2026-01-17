-- Create user_tenants table (from previous implementation, now integrated)
CREATE TABLE IF NOT EXISTS user_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'support')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Create platform_users table (from previous implementation, now integrated)
CREATE TABLE IF NOT EXISTS platform_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    role TEXT NOT NULL CHECK (role = 'super_admin'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create audit_logs table (from previous implementation, now integrated)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for user_tenants
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants(tenant_id);

-- Create indexes for platform_users
CREATE INDEX IF NOT EXISTS idx_platform_users_user_id ON platform_users(user_id);

-- Create indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_license_id ON audit_logs(license_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_site_id ON audit_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_values ON audit_logs USING GIN (old_values);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_values ON audit_logs USING GIN (new_values);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON audit_logs USING GIN (metadata);

-- Enable RLS
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tenants
CREATE POLICY "Users can view their own tenant roles"
    ON user_tenants FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage user_tenants"
    ON user_tenants FOR ALL
    USING (true);

-- RLS Policies for platform_users
CREATE POLICY "Users can view their own platform role"
    ON platform_users FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service role can manage platform_users"
    ON platform_users FOR ALL
    USING (true);

-- RLS Policies for audit_logs
CREATE POLICY "Users can view audit_logs for their tenant"
    ON audit_logs FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'super_admin'
        )
    );

CREATE POLICY "Service role can manage audit_logs"
    ON audit_logs FOR ALL
    USING (true);

-- Helper function to check if user is super_admin
CREATE OR REPLACE FUNCTION is_super_admin(check_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM platform_users
        WHERE user_id = check_user_id
        AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's role for a tenant
CREATE OR REPLACE FUNCTION get_user_tenant_role(check_user_id UUID, check_tenant_id UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (
        SELECT role FROM user_tenants
        WHERE user_id = check_user_id
        AND tenant_id = check_tenant_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_tenant_id UUID,
    p_action TEXT,
    p_license_id UUID DEFAULT NULL,
    p_site_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO audit_logs (
        tenant_id,
        license_id,
        site_id,
        user_id,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        metadata,
        ip_address,
        user_agent
    ) VALUES (
        p_tenant_id,
        p_license_id,
        p_site_id,
        COALESCE(p_user_id, auth.uid()),
        p_action,
        p_resource_type,
        p_resource_id,
        p_old_values,
        p_new_values,
        p_metadata,
        p_ip_address,
        p_user_agent
    )
    RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE user_tenants IS 'Maps users to tenants with their role (owner/admin/support)';
COMMENT ON TABLE platform_users IS 'Platform-level users with super_admin role (bypasses tenant isolation)';
COMMENT ON TABLE audit_logs IS 'Audit trail for all domain transfer and site management operations';
COMMENT ON FUNCTION is_super_admin IS 'Checks if a user has super_admin role (platform-level)';
COMMENT ON FUNCTION get_user_tenant_role IS 'Gets a user''s role for a specific tenant';
COMMENT ON FUNCTION log_audit_event IS 'Helper function to log audit events with proper tenant/user context';
