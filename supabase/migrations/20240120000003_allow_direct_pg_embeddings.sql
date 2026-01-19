-- Allow direct Postgres connections to query embeddings table
-- This is needed for pgvector similarity search which requires direct Postgres access
-- Direct connections use postgres user (not authenticated via Supabase auth)
-- So RLS policies checking user_tenants fail because there's no auth.uid()

-- Drop policy if it exists, then create new one
DROP POLICY IF EXISTS "Direct Postgres connections can read embeddings" ON embeddings;

-- Add policy that allows postgres role (used by direct connections) to read embeddings
-- We validate tenant_id/site_id in application code before querying
CREATE POLICY "Direct Postgres connections can read embeddings"
    ON embeddings FOR SELECT
    TO postgres
    USING (true); -- Allow all reads - tenant/site isolation enforced by WHERE clause in queries

COMMENT ON POLICY "Direct Postgres connections can read embeddings" ON embeddings IS 
'Allows direct Postgres connections (for pgvector queries) to read embeddings. Tenant/site isolation is enforced by WHERE clause in application queries.';
