-- Update licenses table for domain transfer limits
-- Adds max_sites and plan_limits fields for detach cooldown/limits

-- Add max_sites column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'licenses' AND column_name = 'max_sites'
    ) THEN
        ALTER TABLE licenses ADD COLUMN max_sites INTEGER DEFAULT 2;
    END IF;
END $$;

-- Update plan_limits to include detach cooldown and monthly limit
-- This extends the existing plan_limits JSONB structure
UPDATE licenses
SET plan_limits = COALESCE(plan_limits, '{}'::jsonb) || jsonb_build_object(
    'detach_cooldown_hours', COALESCE((plan_limits->>'detach_cooldown_hours')::integer, 24),
    'max_detach_per_month', COALESCE((plan_limits->>'max_detach_per_month')::integer, 3)
)
WHERE plan_limits IS NULL OR NOT (plan_limits ? 'detach_cooldown_hours');

-- Update the validate_plan_limits trigger to include new fields
CREATE OR REPLACE FUNCTION validate_plan_limits()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.plan_limits IS NOT NULL THEN
        -- Ensure all required keys exist, set defaults if missing
        IF NOT (NEW.plan_limits ? 'max_tokens_per_day') THEN
            NEW.plan_limits := NEW.plan_limits || '{"max_tokens_per_day": 1000000}'::jsonb;
        END IF;
        IF NOT (NEW.plan_limits ? 'max_chat_requests_per_day') THEN
            NEW.plan_limits := NEW.plan_limits || '{"max_chat_requests_per_day": 1000}'::jsonb;
        END IF;
        IF NOT (NEW.plan_limits ? 'max_embedding_tokens_per_day') THEN
            NEW.plan_limits := NEW.plan_limits || '{"max_embedding_tokens_per_day": 100000}'::jsonb;
        END IF;
        -- Add detach-related defaults
        IF NOT (NEW.plan_limits ? 'detach_cooldown_hours') THEN
            NEW.plan_limits := NEW.plan_limits || '{"detach_cooldown_hours": 24}'::jsonb;
        END IF;
        IF NOT (NEW.plan_limits ? 'max_detach_per_month') THEN
            NEW.plan_limits := NEW.plan_limits || '{"max_detach_per_month": 3}'::jsonb;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON COLUMN licenses.max_sites IS 'Maximum number of active sites allowed per license (default: 2 for prod+staging)';
COMMENT ON COLUMN licenses.plan_limits IS 'JSONB with plan limits including: max_tokens_per_day, max_chat_requests_per_day, max_embedding_tokens_per_day, detach_cooldown_hours, max_detach_per_month';
