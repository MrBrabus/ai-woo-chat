-- Create licenses table
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    license_key TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'suspended')),
    max_sites INTEGER NOT NULL DEFAULT 2,
    plan_limits JSONB NOT NULL DEFAULT '{
        "max_tokens_per_day": 1000000,
        "max_chat_requests_per_day": 1000,
        "max_embedding_tokens_per_day": 100000,
        "detach_cooldown_hours": 24,
        "max_detach_per_month": 3
    }'::jsonb,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_plan_limits ON licenses USING GIN (plan_limits);

-- Enable RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view licenses for their tenants
-- Note: This policy will be updated after user_tenants and platform_users tables are created
CREATE POLICY "Users can view licenses for their tenants"
    ON licenses FOR SELECT
    USING (true); -- Temporary: will be updated in later migration

-- RLS Policy: Service role can manage all licenses
CREATE POLICY "Service role can manage licenses"
    ON licenses FOR ALL
    USING (true);

-- Trigger to validate plan_limits structure
CREATE OR REPLACE FUNCTION validate_plan_limits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.plan_limits IS NOT NULL THEN
        -- Ensure all required keys exist, set defaults if missing
        IF NOT (NEW.plan_limits ? 'max_tokens_per_day') THEN
            NEW.plan_limits := NEW.plan_limits || '{"max_tokens_per_day": 1000000}'::jsonb;
        END IF;
        IF NOT (NEW.plan_limits ? 'max_chat_requests_per_day') THEN
            NEW.plan_limits := NEW.plan_limits || '{"max_chat_requests_per_day": 1000}'::jsonb;
        END IF;
        IF NOT (NEW.plan_limits ? 'max_embedding_tokens_per_day') THEN
            NEW.plan_limits := NEW.plan_limits || '{"max_embedding_tokens_per_day": 100000}'::jsonb;
        END IF;
        IF NOT (NEW.plan_limits ? 'detach_cooldown_hours') THEN
            NEW.plan_limits := NEW.plan_limits || '{"detach_cooldown_hours": 24}'::jsonb;
        END IF;
        IF NOT (NEW.plan_limits ? 'max_detach_per_month') THEN
            NEW.plan_limits := NEW.plan_limits || '{"max_detach_per_month": 3}'::jsonb;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_plan_limits
    BEFORE INSERT OR UPDATE ON licenses
    FOR EACH ROW
    EXECUTE FUNCTION validate_plan_limits();

-- Add comment
COMMENT ON TABLE licenses IS 'License table with plan limits and site management';
COMMENT ON COLUMN licenses.plan_limits IS 'JSONB with plan limits: max_tokens_per_day, max_chat_requests_per_day, max_embedding_tokens_per_day, detach_cooldown_hours, max_detach_per_month';
