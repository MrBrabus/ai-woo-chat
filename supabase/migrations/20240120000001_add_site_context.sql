-- Add site_context column to sites table
-- Stores site context information (contact, working hours, policies, shop info)

ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS site_context JSONB DEFAULT NULL;

-- Add index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_sites_site_context ON sites USING GIN (site_context);

-- Add comment
COMMENT ON COLUMN sites.site_context IS 'Site context information from WordPress: contact info, working hours, policies, shop info';
