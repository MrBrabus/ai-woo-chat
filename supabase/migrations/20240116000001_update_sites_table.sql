-- Update sites table for domain transfer functionality
-- Adds status, environment, allowed_origins, and tracking fields

-- Add status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sites' AND column_name = 'status'
    ) THEN
        ALTER TABLE sites ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'revoked'));
    END IF;
END $$;

-- Add environment column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sites' AND column_name = 'environment'
    ) THEN
        ALTER TABLE sites ADD COLUMN environment TEXT DEFAULT 'production' CHECK (environment IN ('production', 'staging'));
    END IF;
END $$;

-- Add allowed_origins column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sites' AND column_name = 'allowed_origins'
    ) THEN
        ALTER TABLE sites ADD COLUMN allowed_origins TEXT[] DEFAULT ARRAY[]::TEXT[];
    END IF;
END $$;

-- Add secret_rotated_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sites' AND column_name = 'secret_rotated_at'
    ) THEN
        ALTER TABLE sites ADD COLUMN secret_rotated_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add disabled_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sites' AND column_name = 'disabled_at'
    ) THEN
        ALTER TABLE sites ADD COLUMN disabled_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add last_paired_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sites' AND column_name = 'last_paired_at'
    ) THEN
        ALTER TABLE sites ADD COLUMN last_paired_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);
CREATE INDEX IF NOT EXISTS idx_sites_environment ON sites(environment);
CREATE INDEX IF NOT EXISTS idx_sites_license_id ON sites(license_id);

-- Update existing sites to have default allowed_origins based on site_url
-- Extract origin from site_url and set it as allowed_origins
UPDATE sites
SET allowed_origins = ARRAY[
    CASE 
        WHEN site_url ~ '^https?://' THEN
            regexp_replace(
                regexp_replace(site_url, '^https?://([^/]+).*', '\1'),
                ':\d+$', ''
            )
        ELSE NULL
    END
]::TEXT[]
WHERE allowed_origins IS NULL OR array_length(allowed_origins, 1) IS NULL;

-- Set last_paired_at for existing sites (use created_at if available, otherwise now)
UPDATE sites
SET last_paired_at = COALESCE(created_at, NOW())
WHERE last_paired_at IS NULL;

-- Add comment
COMMENT ON COLUMN sites.status IS 'Site status: active, disabled, or revoked';
COMMENT ON COLUMN sites.environment IS 'Environment: production or staging';
COMMENT ON COLUMN sites.allowed_origins IS 'Array of allowed CORS origins (scheme + host + optional port)';
COMMENT ON COLUMN sites.secret_rotated_at IS 'Timestamp when site_secret was last rotated';
COMMENT ON COLUMN sites.disabled_at IS 'Timestamp when site was disabled/detached';
COMMENT ON COLUMN sites.last_paired_at IS 'Timestamp when site was last paired/activated';
