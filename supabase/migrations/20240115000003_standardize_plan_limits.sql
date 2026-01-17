-- Standardize licenses.plan_limits JSONB keys
-- This migration updates existing plan_limits to use standardized keys
-- Note: The validate_plan_limits() function and trigger are already created in 20240101000003_create_licenses.sql

-- Update existing plan_limits to use standardized keys (if any exist)
-- This handles various possible key names that might exist
UPDATE licenses
SET plan_limits = jsonb_build_object(
    'max_tokens_per_day', COALESCE(
        plan_limits->>'max_tokens_per_day',
        plan_limits->>'maxTokensPerDay',
        plan_limits->>'max_tokens',
        plan_limits->>'daily_token_limit',
        '1000000'::text
    )::bigint,
    'max_chat_requests_per_day', COALESCE(
        plan_limits->>'max_chat_requests_per_day',
        plan_limits->>'maxChatRequestsPerDay',
        plan_limits->>'max_chat_requests',
        plan_limits->>'daily_chat_limit',
        '1000'::text
    )::bigint,
    'max_embedding_tokens_per_day', COALESCE(
        plan_limits->>'max_embedding_tokens_per_day',
        plan_limits->>'maxEmbeddingTokensPerDay',
        plan_limits->>'max_embedding_tokens',
        plan_limits->>'daily_embedding_token_limit',
        '100000'::text
    )::bigint,
    'detach_cooldown_hours', COALESCE(
        (plan_limits->>'detach_cooldown_hours')::integer,
        24
    ),
    'max_detach_per_month', COALESCE(
        (plan_limits->>'max_detach_per_month')::integer,
        3
    )
)
WHERE plan_limits IS NOT NULL;
