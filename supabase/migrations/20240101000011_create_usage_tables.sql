-- Create usage_events table (from previous implementation, now integrated)
CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('chat', 'embedding')),
    model TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    latency_ms INTEGER,
    success BOOLEAN NOT NULL DEFAULT true,
    error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create usage_daily table (from previous implementation, now integrated)
CREATE TABLE IF NOT EXISTS usage_daily (
    date DATE NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    chat_requests INTEGER NOT NULL DEFAULT 0,
    embedding_requests INTEGER NOT NULL DEFAULT 0,
    total_tokens BIGINT NOT NULL DEFAULT 0,
    estimated_cost NUMERIC(12, 6) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date, site_id)
);

-- Create indexes for usage_events
CREATE INDEX IF NOT EXISTS idx_usage_events_tenant_id ON usage_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_site_id ON usage_events(site_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_events_type ON usage_events(type);
CREATE INDEX IF NOT EXISTS idx_usage_events_conversation_id ON usage_events(conversation_id);

-- Create indexes for usage_daily
CREATE INDEX IF NOT EXISTS idx_usage_daily_tenant_id ON usage_daily(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_daily_site_id ON usage_daily(site_id);
CREATE INDEX IF NOT EXISTS idx_usage_daily_date ON usage_daily(date);

-- Enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_daily ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view usage_events for their tenant
-- Note: These policies will be updated after user_tenants and platform_users tables are created
CREATE POLICY "Users can view usage_events for their tenant"
    ON usage_events FOR SELECT
    USING (true); -- Temporary: will be updated in later migration

-- RLS Policy: Users can view usage_daily for their tenant
CREATE POLICY "Users can view usage_daily for their tenant"
    ON usage_daily FOR SELECT
    USING (true); -- Temporary: will be updated in later migration

-- RLS Policy: Service role can manage usage tables
CREATE POLICY "Service role can manage usage_events"
    ON usage_events FOR ALL
    USING (true);

CREATE POLICY "Service role can manage usage_daily"
    ON usage_daily FOR ALL
    USING (true);

-- Add comments
COMMENT ON TABLE usage_events IS 'Logs all OpenAI API usage events (chat and embedding) for cost tracking and analytics';
COMMENT ON TABLE usage_daily IS 'Daily aggregated usage statistics per site for plan limit enforcement';
