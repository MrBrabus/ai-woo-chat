-- Create SECURITY DEFINER function for pgvector similarity search
-- This function bypasses RLS policies when called from direct Postgres connections
-- The function validates tenant_id/site_id internally, so it's safe

CREATE OR REPLACE FUNCTION search_embeddings(
  p_query_embedding vector(1536),
  p_tenant_id UUID,
  p_site_id UUID,
  p_entity_types TEXT[] DEFAULT ARRAY['product', 'page', 'policy']::TEXT[],
  p_limit INTEGER DEFAULT 10,
  p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  id UUID,
  site_id UUID,
  tenant_id UUID,
  entity_type TEXT,
  entity_id TEXT,
  content_text TEXT,
  model TEXT,
  version INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distance FLOAT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS - runs with function owner's privileges
SET search_path = public
AS $$
BEGIN
  -- Validate tenant_id exists (safety check)
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;

  -- Validate site_id exists (safety check)
  IF NOT EXISTS (SELECT 1 FROM sites WHERE id = p_site_id) THEN
    RAISE EXCEPTION 'Site not found: %', p_site_id;
  END IF;

  -- Perform similarity search with tenant/site isolation
  RETURN QUERY
  SELECT
    e.id,
    e.site_id,
    e.tenant_id,
    e.entity_type,
    e.entity_id,
    e.content_text,
    e.model,
    e.version,
    e.metadata,
    e.created_at,
    e.updated_at,
    (e.embedding <=> p_query_embedding)::FLOAT as distance,
    (1 - (e.embedding <=> p_query_embedding)::FLOAT / 2)::FLOAT as similarity
  FROM embeddings e
  WHERE
    e.embedding IS NOT NULL
    AND e.tenant_id = p_tenant_id
    AND e.site_id = p_site_id
    AND e.entity_type = ANY(p_entity_types)
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION search_embeddings IS 
'SECURITY DEFINER function for pgvector similarity search. Bypasses RLS to allow direct Postgres connections. Validates tenant_id/site_id internally.';

-- Grant execute permission to postgres role (used by direct connections)
GRANT EXECUTE ON FUNCTION search_embeddings TO postgres;
GRANT EXECUTE ON FUNCTION search_embeddings TO authenticated;
