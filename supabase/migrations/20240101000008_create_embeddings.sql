-- Create embeddings table with pgvector
CREATE TABLE IF NOT EXISTS embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('product', 'page', 'policy')),
    entity_id TEXT NOT NULL,
    content_text TEXT NOT NULL,
    embedding vector(1536), -- OpenAI embedding dimension (adjust if using different model)
    model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    version INTEGER NOT NULL DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, entity_type, entity_id, version)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_embeddings_site_id ON embeddings(site_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_tenant_id ON embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_version ON embeddings(version);
CREATE INDEX IF NOT EXISTS idx_embeddings_metadata ON embeddings USING GIN (metadata);

-- Vector similarity search index (HNSW for fast approximate nearest neighbor search)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Enable RLS
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all embeddings
CREATE POLICY "Service role can manage embeddings"
    ON embeddings FOR ALL
    USING (true);

-- RLS Policy: Users can view embeddings for their tenants
-- Note: This policy will be updated after user_tenants and platform_users tables are created
CREATE POLICY "Users can view embeddings for their tenants"
    ON embeddings FOR SELECT
    USING (true); -- Temporary: will be updated in later migration

-- Add comments
COMMENT ON TABLE embeddings IS 'Vector embeddings for RAG (Retrieval Augmented Generation)';
COMMENT ON COLUMN embeddings.embedding IS 'pgvector embedding (1536 dimensions for OpenAI text-embedding-3-small)';
COMMENT ON COLUMN embeddings.version IS 'Version number for embeddings versioning';
COMMENT ON COLUMN embeddings.metadata IS 'JSONB metadata about the embedding';
