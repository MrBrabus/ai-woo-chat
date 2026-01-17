-- Create chat_events table for tracking user interactions
CREATE TABLE IF NOT EXISTS chat_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('view', 'click', 'add_to_cart', 'purchase')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_events_site_id ON chat_events(site_id);
CREATE INDEX IF NOT EXISTS idx_chat_events_visitor_id ON chat_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_chat_events_conversation_id ON chat_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_events_event_type ON chat_events(event_type);
CREATE INDEX IF NOT EXISTS idx_chat_events_created_at ON chat_events(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_events_payload ON chat_events USING GIN (payload);

-- Enable RLS
ALTER TABLE chat_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all chat_events (for runtime)
CREATE POLICY "Service role can manage chat_events"
    ON chat_events FOR ALL
    USING (true);

-- Add comment
COMMENT ON TABLE chat_events IS 'User interaction events (view, click, add_to_cart, purchase)';
COMMENT ON COLUMN chat_events.payload IS 'JSONB event payload (product_id, url, etc.)';
