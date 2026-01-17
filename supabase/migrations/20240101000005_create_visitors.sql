-- Create visitors table
CREATE TABLE IF NOT EXISTS visitors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL, -- External visitor ID from frontend
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, visitor_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_visitors_site_id ON visitors(site_id);
CREATE INDEX IF NOT EXISTS idx_visitors_visitor_id ON visitors(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitors_last_seen_at ON visitors(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_visitors_metadata ON visitors USING GIN (metadata);

-- Enable RLS
ALTER TABLE visitors ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all visitors (for runtime)
CREATE POLICY "Service role can manage visitors"
    ON visitors FOR ALL
    USING (true);

-- Add comment
COMMENT ON TABLE visitors IS 'Chat visitors tracking per site';
COMMENT ON COLUMN visitors.visitor_id IS 'External visitor ID from frontend (e.g., vis_abc123)';
COMMENT ON COLUMN visitors.metadata IS 'JSONB metadata about the visitor';
