-- Verification queries for retention policy migration
-- Run these queries to verify that retention policy is properly set up

-- 1. Check if pg_cron extension is enabled
SELECT 
    extname as extension_name,
    extversion as version
FROM pg_extension 
WHERE extname = 'pg_cron';

-- 2. Check if cleanup_old_data function exists
SELECT 
    p.proname as function_name,
    pg_get_function_result(p.oid) as return_type,
    pg_get_function_arguments(p.oid) as arguments,
    p.prosecdef as is_security_definer,
    obj_description(p.oid, 'pg_proc') as comment
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'cleanup_old_data';

-- 3. Check function permissions (grants)
SELECT 
    p.proname as function_name,
    r.rolname as role_name,
    has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
CROSS JOIN pg_roles r
WHERE n.nspname = 'public'
AND p.proname = 'cleanup_old_data'
AND r.rolname IN ('postgres', 'authenticated', 'anon')
ORDER BY r.rolname;

-- 4. Check if cron job is scheduled (if pg_cron is available)
SELECT 
    jobid,
    schedule,
    command,
    nodename,
    nodeport,
    database,
    username,
    active,
    jobname
FROM cron.job
WHERE jobname = 'cleanup-old-data-daily';

-- 5. Check current data age (oldest records)
SELECT 
    'messages' as table_name,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') as records_older_than_90_days
FROM messages
UNION ALL
SELECT 
    'conversations' as table_name,
    MIN(last_message_at) as oldest_record,
    MAX(last_message_at) as newest_record,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE last_message_at < NOW() - INTERVAL '90 days') as records_older_than_90_days
FROM conversations
UNION ALL
SELECT 
    'chat_events' as table_name,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') as records_older_than_90_days
FROM chat_events
UNION ALL
SELECT 
    'usage_events' as table_name,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '90 days') as records_older_than_90_days
FROM usage_events;

-- 6. Check data that would be deleted on next run (90 days ago)
-- This shows what would be deleted if you run cleanup_old_data() now
SELECT 
    'messages' as table_name,
    DATE_TRUNC('day', created_at)::DATE as target_date,
    COUNT(*) as records_to_delete
FROM messages
WHERE DATE_TRUNC('day', created_at)::DATE = (CURRENT_DATE - INTERVAL '90 days')::DATE
GROUP BY DATE_TRUNC('day', created_at)::DATE
UNION ALL
SELECT 
    'conversations' as table_name,
    DATE_TRUNC('day', last_message_at)::DATE as target_date,
    COUNT(*) as records_to_delete
FROM conversations
WHERE DATE_TRUNC('day', last_message_at)::DATE = (CURRENT_DATE - INTERVAL '90 days')::DATE
AND NOT EXISTS (
    SELECT 1 FROM messages 
    WHERE messages.conversation_id = conversations.id
)
GROUP BY DATE_TRUNC('day', last_message_at)::DATE
UNION ALL
SELECT 
    'chat_events' as table_name,
    DATE_TRUNC('day', created_at)::DATE as target_date,
    COUNT(*) as records_to_delete
FROM chat_events
WHERE DATE_TRUNC('day', created_at)::DATE = (CURRENT_DATE - INTERVAL '90 days')::DATE
GROUP BY DATE_TRUNC('day', created_at)::DATE
UNION ALL
SELECT 
    'usage_events' as table_name,
    DATE_TRUNC('day', created_at)::DATE as target_date,
    COUNT(*) as records_to_delete
FROM usage_events
WHERE DATE_TRUNC('day', created_at)::DATE = (CURRENT_DATE - INTERVAL '90 days')::DATE
GROUP BY DATE_TRUNC('day', created_at)::DATE;

-- 7. Test function call (DRY RUN - shows what would be deleted without actually deleting)
-- WARNING: This is a read-only query, it won't delete anything
-- To actually test deletion, uncomment the SELECT cleanup_old_data() below
-- SELECT cleanup_old_data();

-- 8. Summary: Overall retention policy status
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') 
        THEN 'pg_cron extension: ENABLED ✅'
        ELSE 'pg_cron extension: NOT AVAILABLE ⚠️'
    END as pg_cron_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = 'cleanup_old_data'
        )
        THEN 'cleanup_old_data function: EXISTS ✅'
        ELSE 'cleanup_old_data function: MISSING ❌'
    END as function_status,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM cron.job 
            WHERE jobname = 'cleanup-old-data-daily'
        )
        THEN 'Cron job: SCHEDULED ✅'
        ELSE 'Cron job: NOT SCHEDULED ⚠️ (use external cron)'
    END as cron_job_status;
