-- Create ingestion_events table for idempotency
CREATE TABLE IF NOT EXISTS ingestion_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL, -- External event ID from WordPress (for idempotency)
    event_type TEXT NOT NULL CHECK (event_type IN ('product.updated', 'product.deleted', 'page.updated', 'page.deleted', 'policy.updated')),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'page', 'policy')),
    entity_id TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, event_id) -- Ensures idempotency
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ingestion_events_site_id ON ingestion_events(site_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_events_event_id ON ingestion_events(event_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_events_status ON ingestion_events(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_events_entity ON ingestion_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ingestion_events_occurred_at ON ingestion_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_events_metadata ON ingestion_events USING GIN (metadata);

-- Enable RLS
ALTER TABLE ingestion_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all ingestion events
CREATE POLICY "Service role can manage ingestion_events"
    ON ingestion_events FOR ALL
    USING (true);

-- Add comments
COMMENT ON TABLE ingestion_events IS 'Ingestion events from WordPress webhooks (idempotency tracking)';
COMMENT ON COLUMN ingestion_events.event_id IS 'External event ID from WordPress (UUID) - ensures idempotency';
COMMENT ON COLUMN ingestion_events.metadata IS 'JSONB metadata about the ingestion event';
