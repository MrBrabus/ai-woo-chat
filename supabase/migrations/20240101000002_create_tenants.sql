-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on slug for fast lookups
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view tenants they belong to
-- Note: This policy will be updated after user_tenants and platform_users tables are created
CREATE POLICY "Users can view their tenants"
    ON tenants FOR SELECT
    USING (true); -- Temporary: will be updated in later migration

-- RLS Policy: Service role can manage all tenants
CREATE POLICY "Service role can manage tenants"
    ON tenants FOR ALL
    USING (true);

-- Add comment
COMMENT ON TABLE tenants IS 'Tenant/organization table for multi-tenancy support';
