-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Add comment
COMMENT ON EXTENSION vector IS 'pgvector extension for storing and querying vector embeddings';
