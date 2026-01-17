-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    visitor_id UUID REFERENCES visitors(id) ON DELETE SET NULL,
    conversation_id TEXT NOT NULL, -- External conversation ID from frontend
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    message_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, conversation_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_conversations_site_id ON conversations(site_id);
CREATE INDEX IF NOT EXISTS idx_conversations_visitor_id ON conversations(visitor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_conversation_id ON conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON conversations(last_message_at);
CREATE INDEX IF NOT EXISTS idx_conversations_metadata ON conversations USING GIN (metadata);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all conversations (for runtime)
CREATE POLICY "Service role can manage conversations"
    ON conversations FOR ALL
    USING (true);

-- Add comment
COMMENT ON TABLE conversations IS 'Chat conversations tracking';
COMMENT ON COLUMN conversations.conversation_id IS 'External conversation ID from frontend (e.g., conv_xyz789)';
COMMENT ON COLUMN conversations.metadata IS 'JSONB metadata about the conversation';
