-- Create settings table with versioning
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, key, version)
);

-- Create settings_history table for versioning
CREATE TABLE IF NOT EXISTS settings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settings_id UUID NOT NULL REFERENCES settings(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    version INTEGER NOT NULL,
    changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    change_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for settings
CREATE INDEX IF NOT EXISTS idx_settings_site_id ON settings(site_id);
CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_settings_version ON settings(version);
CREATE INDEX IF NOT EXISTS idx_settings_is_active ON settings(is_active);
CREATE INDEX IF NOT EXISTS idx_settings_value ON settings USING GIN (value);

-- Create indexes for settings_history
CREATE INDEX IF NOT EXISTS idx_settings_history_settings_id ON settings_history(settings_id);
CREATE INDEX IF NOT EXISTS idx_settings_history_site_id ON settings_history(site_id);
CREATE INDEX IF NOT EXISTS idx_settings_history_tenant_id ON settings_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_settings_history_key ON settings_history(key);
CREATE INDEX IF NOT EXISTS idx_settings_history_version ON settings_history(version);
CREATE INDEX IF NOT EXISTS idx_settings_history_created_at ON settings_history(created_at);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view settings for their tenants
-- Note: These policies will be updated after user_tenants and platform_users tables are created
CREATE POLICY "Users can view settings for their tenants"
    ON settings FOR SELECT
    USING (true); -- Temporary: will be updated in later migration

CREATE POLICY "Users can view settings_history for their tenants"
    ON settings_history FOR SELECT
    USING (true); -- Temporary: will be updated in later migration

-- RLS Policy: Service role can manage all settings
CREATE POLICY "Service role can manage settings"
    ON settings FOR ALL
    USING (true);

CREATE POLICY "Service role can manage settings_history"
    ON settings_history FOR ALL
    USING (true);

-- Function to create history entry when settings are updated
CREATE OR REPLACE FUNCTION create_settings_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert into history before update
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO settings_history (
            settings_id, site_id, tenant_id, key, value, version, changed_by
        ) VALUES (
            OLD.id, OLD.site_id, OLD.tenant_id, OLD.key, OLD.value, OLD.version, auth.uid()
        );
        
        -- Increment version
        NEW.version := OLD.version + 1;
    ELSIF TG_OP = 'INSERT' THEN
        -- For new settings, version starts at 1
        NEW.version := 1;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically create history entries
CREATE TRIGGER trigger_settings_history
    BEFORE INSERT OR UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION create_settings_history();

-- Add comments
COMMENT ON TABLE settings IS 'Site settings with versioning support';
COMMENT ON TABLE settings_history IS 'Version history for settings changes';
COMMENT ON COLUMN settings.value IS 'JSONB setting value';
COMMENT ON COLUMN settings.version IS 'Version number for this setting';
