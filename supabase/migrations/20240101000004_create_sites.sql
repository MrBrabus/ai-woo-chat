-- Create sites table
CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    site_url TEXT NOT NULL,
    site_name TEXT NOT NULL,
    site_secret TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'revoked')),
    environment TEXT NOT NULL DEFAULT 'production' CHECK (environment IN ('production', 'staging')),
    allowed_origins TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    secret_rotated_at TIMESTAMPTZ,
    disabled_at TIMESTAMPTZ,
    last_paired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sites_tenant_id ON sites(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sites_license_id ON sites(license_id);
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);
CREATE INDEX IF NOT EXISTS idx_sites_environment ON sites(environment);
CREATE INDEX IF NOT EXISTS idx_sites_site_url ON sites(site_url);
CREATE INDEX IF NOT EXISTS idx_sites_allowed_origins ON sites USING GIN (allowed_origins);

-- Enable RLS
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view sites for their tenants
-- Note: This policy will be updated after user_tenants and platform_users tables are created
CREATE POLICY "Users can view sites for their tenants"
    ON sites FOR SELECT
    USING (true); -- Temporary: will be updated in later migration

-- RLS Policy: Service role can manage all sites
CREATE POLICY "Service role can manage sites"
    ON sites FOR ALL
    USING (true);

-- Add comments
COMMENT ON TABLE sites IS 'WordPress sites linked to licenses';
COMMENT ON COLUMN sites.status IS 'Site status: active, disabled, or revoked';
COMMENT ON COLUMN sites.environment IS 'Environment: production or staging';
COMMENT ON COLUMN sites.allowed_origins IS 'Array of allowed CORS origins (scheme + host + optional port)';
COMMENT ON COLUMN sites.secret_rotated_at IS 'Timestamp when site_secret was last rotated';
COMMENT ON COLUMN sites.disabled_at IS 'Timestamp when site was disabled/detached';
COMMENT ON COLUMN sites.last_paired_at IS 'Timestamp when site was last paired/activated';
