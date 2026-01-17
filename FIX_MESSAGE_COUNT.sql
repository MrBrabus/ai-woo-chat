-- Fix message_count for all conversations
-- Run this after SETUP_TEST_CONVERSATIONS.sql to update message_count to match actual messages

-- Update message_count for all conversations based on actual message count
UPDATE conversations c
SET message_count = (
    SELECT COUNT(*) 
    FROM messages m 
    WHERE m.conversation_id = c.id
)
WHERE c.site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid;

-- Verify the update
SELECT 
    c.id,
    c.conversation_id,
    c.message_count as db_count,
    COUNT(m.id) as actual_count,
    CASE 
        WHEN c.message_count = COUNT(m.id) THEN '✅ Match'
        ELSE '❌ Mismatch'
    END as status
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid
GROUP BY c.id, c.conversation_id, c.message_count
ORDER BY c.started_at DESC;
