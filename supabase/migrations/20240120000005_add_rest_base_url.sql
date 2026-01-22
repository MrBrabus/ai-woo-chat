-- Add rest_base_url column to sites table
-- Stores the discovered WordPress REST API base URL (e.g., /wp-json/ or /index.php/wp-json/)
-- This allows the SaaS platform to work with WordPress sites that use non-standard permalink structures

ALTER TABLE sites 
ADD COLUMN IF NOT EXISTS rest_base_url TEXT DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN sites.rest_base_url IS 'WordPress REST API base URL path (e.g., /wp-json/ or /index.php/wp-json/). Discovered automatically during activation or sync.';
