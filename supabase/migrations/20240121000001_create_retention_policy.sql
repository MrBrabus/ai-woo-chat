-- Create retention policy with daily rotation
-- Deletes data for one day (90 days ago) each day
-- This prevents database bloat while maintaining 90 days of history

-- Enable pg_cron extension (if available in Supabase)
-- Note: Supabase may require enabling this via dashboard or may not support it
-- If pg_cron is not available, use external cron job to call cleanup_old_data() function
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create function to cleanup old data for one specific day (90 days ago)
-- This function deletes all data from tables for a single day (90 days back)
-- It's designed to be called daily, removing one day at a time
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE (
    table_name TEXT,
    deleted_count BIGINT,
    target_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS - runs with function owner's privileges
SET search_path = public
AS $$
DECLARE
    v_target_date DATE;
    v_messages_deleted BIGINT := 0;
    v_conversations_deleted BIGINT := 0;
    v_chat_events_deleted BIGINT := 0;
    v_usage_events_deleted BIGINT := 0;
BEGIN
    -- Calculate target date: exactly 90 days ago
    v_target_date := (CURRENT_DATE - INTERVAL '90 days')::DATE;
    
    -- Delete messages for the target day
    -- Using DATE_TRUNC to match entire day (00:00:00 to 23:59:59)
    DELETE FROM messages
    WHERE DATE_TRUNC('day', created_at)::DATE = v_target_date;
    GET DIAGNOSTICS v_messages_deleted = ROW_COUNT;
    
    -- Delete conversations that have no messages left (orphaned conversations)
    -- Only delete if last_message_at is on the target day
    DELETE FROM conversations
    WHERE DATE_TRUNC('day', last_message_at)::DATE = v_target_date
    AND NOT EXISTS (
        SELECT 1 FROM messages 
        WHERE messages.conversation_id = conversations.id
    );
    GET DIAGNOSTICS v_conversations_deleted = ROW_COUNT;
    
    -- Delete chat_events for the target day
    DELETE FROM chat_events
    WHERE DATE_TRUNC('day', created_at)::DATE = v_target_date;
    GET DIAGNOSTICS v_chat_events_deleted = ROW_COUNT;
    
    -- Delete usage_events for the target day
    -- Note: usage_daily aggregates are kept for analytics
    DELETE FROM usage_events
    WHERE DATE_TRUNC('day', created_at)::DATE = v_target_date;
    GET DIAGNOSTICS v_usage_events_deleted = ROW_COUNT;
    
    -- Return results
    RETURN QUERY SELECT 'messages'::TEXT, v_messages_deleted, v_target_date;
    RETURN QUERY SELECT 'conversations'::TEXT, v_conversations_deleted, v_target_date;
    RETURN QUERY SELECT 'chat_events'::TEXT, v_chat_events_deleted, v_target_date;
    RETURN QUERY SELECT 'usage_events'::TEXT, v_usage_events_deleted, v_target_date;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION cleanup_old_data TO postgres;
GRANT EXECUTE ON FUNCTION cleanup_old_data TO authenticated;

-- Schedule cron job to run daily at 3 AM UTC
-- Note: This may fail if pg_cron is not enabled in Supabase
-- If pg_cron is not available, use external cron job (e.g., GitHub Actions, Vercel Cron, or server cron)
DO $$
BEGIN
    -- Try to schedule the job, but don't fail if pg_cron is not available
    PERFORM cron.schedule(
        'cleanup-old-data-daily',
        '0 3 * * *', -- Run daily at 3 AM UTC
        'SELECT cleanup_old_data()'
    );
EXCEPTION
    WHEN OTHERS THEN
        -- If pg_cron is not available, log warning but don't fail migration
        RAISE NOTICE 'pg_cron not available. Schedule cleanup_old_data() manually via external cron job.';
END $$;

-- Add comment about function usage
COMMENT ON FUNCTION cleanup_old_data IS 
'Retention policy function: Deletes data for one day (90 days ago) each time it runs. Designed for daily execution to maintain 90 days of history. Returns count of deleted rows per table. If pg_cron is not available, schedule this function to run daily via external cron job (GitHub Actions, Vercel Cron, server cron, etc.). Example: SELECT cleanup_old_data();';
