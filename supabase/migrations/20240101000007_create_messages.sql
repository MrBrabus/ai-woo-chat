-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content_text TEXT, -- Plain text content
    content_json JSONB, -- Structured content (products, actions, etc.)
    token_usage JSONB, -- Token usage: {prompt_tokens, completion_tokens, total_tokens}
    model TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_site_id ON messages(site_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_content_json ON messages USING GIN (content_json);
CREATE INDEX IF NOT EXISTS idx_messages_token_usage ON messages USING GIN (token_usage);

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all messages (for runtime)
CREATE POLICY "Service role can manage messages"
    ON messages FOR ALL
    USING (true);

-- Add comments
COMMENT ON TABLE messages IS 'Chat messages with text and structured content';
COMMENT ON COLUMN messages.content_text IS 'Plain text message content';
COMMENT ON COLUMN messages.content_json IS 'Structured JSON content (products, actions, etc.)';
COMMENT ON COLUMN messages.token_usage IS 'JSONB token usage: {prompt_tokens, completion_tokens, total_tokens}';
