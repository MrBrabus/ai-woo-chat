-- Setup Test Conversations for AI Woo Chat
-- This script creates sample conversations, visitors, and messages for testing
-- Replace SITE_ID with your actual site_id from the sites table

-- Step 1: Get your site_id (run this first to find it)
-- SELECT id, site_url, site_name FROM sites WHERE status = 'active' LIMIT 1;

-- Step 2: Replace 'YOUR_SITE_ID' below with the actual site_id UUID

-- ============================================
-- Test Data: Visitors
-- ============================================

-- Visitor 1: New customer asking about products
INSERT INTO visitors (id, site_id, visitor_id, first_seen_at, last_seen_at, metadata)
VALUES (
    gen_random_uuid(),
    'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid,  -- Replace with your site_id
    'vis_test_customer_001',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 hour',
    '{"browser": "Chrome", "device": "desktop", "location": "US"}'::jsonb
)
ON CONFLICT (site_id, visitor_id) DO NOTHING
RETURNING id as visitor_id_1;

-- Visitor 2: Returning customer with order question
INSERT INTO visitors (id, site_id, visitor_id, first_seen_at, last_seen_at, metadata)
VALUES (
    gen_random_uuid(),
    'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid,  -- Replace with your site_id
    'vis_test_customer_002',
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '30 minutes',
    '{"browser": "Safari", "device": "mobile", "location": "UK"}'::jsonb
)
ON CONFLICT (site_id, visitor_id) DO NOTHING
RETURNING id as visitor_id_2;

-- Visitor 3: Customer asking about shipping
INSERT INTO visitors (id, site_id, visitor_id, first_seen_at, last_seen_at, metadata)
VALUES (
    gen_random_uuid(),
    'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid,  -- Replace with your site_id
    'vis_test_customer_003',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '15 minutes',
    '{"browser": "Firefox", "device": "desktop", "location": "CA"}'::jsonb
)
ON CONFLICT (site_id, visitor_id) DO NOTHING
RETURNING id as visitor_id_3;

-- Visitor 4: Customer with product recommendation request
INSERT INTO visitors (id, site_id, visitor_id, first_seen_at, last_seen_at, metadata)
VALUES (
    gen_random_uuid(),
    'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid,  -- Replace with your site_id
    'vis_test_customer_004',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '5 minutes',
    '{"browser": "Chrome", "device": "mobile", "location": "US"}'::jsonb
)
ON CONFLICT (site_id, visitor_id) DO NOTHING
RETURNING id as visitor_id_4;

-- ============================================
-- Test Data: Conversations
-- ============================================

-- Conversation 1: Product inquiry about headphones
WITH visitor_data AS (
    SELECT id FROM visitors WHERE visitor_id = 'vis_test_customer_001' AND site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid LIMIT 1
)
INSERT INTO conversations (id, site_id, visitor_id, conversation_id, started_at, last_message_at, message_count, metadata)
SELECT 
    gen_random_uuid(),
    'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid,
    visitor_data.id,
    'conv_headphones_inquiry_' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8),
    NOW() - INTERVAL '2 days' + INTERVAL '3 hours',
    NOW() - INTERVAL '1 hour',
    6,
    '{"topic": "product_inquiry", "products_mentioned": ["headphones", "wireless"], "satisfaction": "high"}'::jsonb
FROM visitor_data
ON CONFLICT (site_id, conversation_id) DO NOTHING
RETURNING id as conversation_id_1;

-- Conversation 2: Order status inquiry
WITH visitor_data AS (
    SELECT id FROM visitors WHERE visitor_id = 'vis_test_customer_002' AND site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid LIMIT 1
)
INSERT INTO conversations (id, site_id, visitor_id, conversation_id, started_at, last_message_at, message_count, metadata)
SELECT 
    gen_random_uuid(),
    'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid,
    visitor_data.id,
    'conv_order_status_' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8),
    NOW() - INTERVAL '5 days' + INTERVAL '2 hours',
    NOW() - INTERVAL '30 minutes',
    8,
    '{"topic": "order_status", "order_id": "12345", "resolved": true}'::jsonb
FROM visitor_data
ON CONFLICT (site_id, conversation_id) DO NOTHING
RETURNING id as conversation_id_2;

-- Conversation 3: Shipping information
WITH visitor_data AS (
    SELECT id FROM visitors WHERE visitor_id = 'vis_test_customer_003' AND site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid LIMIT 1
)
INSERT INTO conversations (id, site_id, visitor_id, conversation_id, started_at, last_message_at, message_count, metadata)
SELECT 
    gen_random_uuid(),
    'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid,
    visitor_data.id,
    'conv_shipping_info_' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8),
    NOW() - INTERVAL '1 day' + INTERVAL '4 hours',
    NOW() - INTERVAL '15 minutes',
    4,
    '{"topic": "shipping", "question_type": "delivery_time", "resolved": true}'::jsonb
FROM visitor_data
ON CONFLICT (site_id, conversation_id) DO NOTHING
RETURNING id as conversation_id_3;

-- Conversation 4: Product recommendations
WITH visitor_data AS (
    SELECT id FROM visitors WHERE visitor_id = 'vis_test_customer_004' AND site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid LIMIT 1
)
INSERT INTO conversations (id, site_id, visitor_id, conversation_id, started_at, last_message_at, message_count, metadata)
SELECT 
    gen_random_uuid(),
    'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid,
    visitor_data.id,
    'conv_recommendations_' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8),
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '5 minutes',
    4,  -- Will be updated automatically after messages are inserted
    '{"topic": "recommendations", "products_recommended": 3, "products_viewed": 2}'::jsonb
FROM visitor_data
ON CONFLICT (site_id, conversation_id) DO NOTHING
RETURNING id as conversation_id_4;

-- ============================================
-- Test Data: Messages
-- ============================================

-- Conversation 1 Messages: Headphones inquiry
WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_headphones_inquiry_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'user',
    'Hi! Do you have wireless headphones available?',
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '2 days' + INTERVAL '3 hours'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'user' AND content_text LIKE '%headphones%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_headphones_inquiry_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'assistant',
    'Yes, we have several wireless headphones available! I can recommend a few options based on your preferences. What are you looking for - over-ear or in-ear?',
    '{"products": [{"id": 101, "title": "Premium Wireless Headphones", "price": 129.99}, {"id": 102, "title": "Budget Wireless Earbuds", "price": 49.99}]}'::jsonb,
    '{"prompt_tokens": 150, "completion_tokens": 80, "total_tokens": 230}'::jsonb,
    'gpt-4',
    NOW() - INTERVAL '2 days' + INTERVAL '3 hours' + INTERVAL '10 seconds'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'assistant' AND content_text LIKE '%wireless headphones%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_headphones_inquiry_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'user',
    'I prefer over-ear headphones. What do you recommend?',
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '2 days' + INTERVAL '3 hours' + INTERVAL '1 minute'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'user' AND content_text LIKE '%over-ear%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_headphones_inquiry_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'assistant',
    'Great choice! For over-ear headphones, I highly recommend our Premium Wireless Headphones. They feature active noise cancellation, 30-hour battery life, and excellent sound quality. They''re currently $129.99. Would you like to see more details?',
    '{"products": [{"id": 101, "title": "Premium Wireless Headphones", "price": 129.99, "stock_status": "instock"}]}'::jsonb,
    '{"prompt_tokens": 200, "completion_tokens": 120, "total_tokens": 320}'::jsonb,
    'gpt-4',
    NOW() - INTERVAL '2 days' + INTERVAL '3 hours' + INTERVAL '1 minute' + INTERVAL '15 seconds'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'assistant' AND content_text LIKE '%Premium Wireless%'
);

-- Conversation 2 Messages: Order status
WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_order_status_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'user',
    'Hi, I placed an order yesterday and I''d like to check the status. Order number is 12345.',
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '5 days' + INTERVAL '2 hours'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'user' AND content_text LIKE '%order%12345%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_order_status_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'assistant',
    'I''d be happy to help you check your order status. To verify your order, could you please provide your billing email address?',
    NULL,
    '{"prompt_tokens": 180, "completion_tokens": 50, "total_tokens": 230}'::jsonb,
    'gpt-4',
    NOW() - INTERVAL '5 days' + INTERVAL '2 hours' + INTERVAL '10 seconds'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'assistant' AND content_text LIKE '%billing email%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_order_status_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'user',
    'Sure, it''s customer@example.com',
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '5 days' + INTERVAL '2 hours' + INTERVAL '1 minute'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'user' AND content_text LIKE '%customer@example.com%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_order_status_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'assistant',
    'Thank you! I found your order #12345. It''s currently being processed and should ship within 1-2 business days. You''ll receive a tracking number via email once it ships. Is there anything else I can help you with?',
    '{"order_id": "12345", "status": "processing", "estimated_ship_date": "2024-01-22"}'::jsonb,
    '{"prompt_tokens": 220, "completion_tokens": 90, "total_tokens": 310}'::jsonb,
    'gpt-4',
    NOW() - INTERVAL '5 days' + INTERVAL '2 hours' + INTERVAL '1 minute' + INTERVAL '20 seconds'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'assistant' AND content_text LIKE '%order #12345%'
);

-- Conversation 3 Messages: Shipping info
WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_shipping_info_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'user',
    'How long does shipping take to Canada?',
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '1 day' + INTERVAL '4 hours'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'user' AND content_text LIKE '%shipping%Canada%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_shipping_info_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'assistant',
    'Shipping to Canada typically takes 7-14 business days via standard shipping, or 3-5 business days with express shipping. Standard shipping is free for orders over $50, and express shipping costs $15. Would you like to see our full shipping policy?',
    '{"shipping_options": [{"type": "standard", "days": "7-14", "cost": "free over $50"}, {"type": "express", "days": "3-5", "cost": "$15"}]}'::jsonb,
    '{"prompt_tokens": 160, "completion_tokens": 70, "total_tokens": 230}'::jsonb,
    'gpt-4',
    NOW() - INTERVAL '1 day' + INTERVAL '4 hours' + INTERVAL '12 seconds'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'assistant' AND content_text LIKE '%Canada%7-14%'
);

-- Conversation 4 Messages: Product recommendations
WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_recommendations_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'user',
    'I''m looking for a gift for my friend who loves photography. Any recommendations?',
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '3 hours'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'user' AND content_text LIKE '%photography%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_recommendations_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'assistant',
    'That''s a great gift idea! For photography enthusiasts, I''d recommend our Camera Lens Cleaning Kit, a Professional Camera Strap, or a Portable Photo Printer. What''s your budget range?',
    '{"products": [{"id": 201, "title": "Camera Lens Cleaning Kit", "price": 29.99}, {"id": 202, "title": "Professional Camera Strap", "price": 45.99}, {"id": 203, "title": "Portable Photo Printer", "price": 149.99}]}'::jsonb,
    '{"prompt_tokens": 190, "completion_tokens": 85, "total_tokens": 275}'::jsonb,
    'gpt-4',
    NOW() - INTERVAL '3 hours' + INTERVAL '10 seconds'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'assistant' AND content_text LIKE '%photography%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_recommendations_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'user',
    'Around $50 would be perfect',
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '3 hours' + INTERVAL '1 minute'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'user' AND content_text LIKE '%$50%'
);

WITH conv_data AS (
    SELECT id, site_id FROM conversations 
    WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid 
    AND conversation_id LIKE 'conv_recommendations_%'
    ORDER BY created_at DESC LIMIT 1
)
INSERT INTO messages (conversation_id, site_id, role, content_text, content_json, token_usage, model, created_at)
SELECT 
    conv_data.id,
    conv_data.site_id,
    'assistant',
    'Perfect! Within that budget, I''d highly recommend the Professional Camera Strap at $45.99. It''s comfortable, durable, and has quick-release buckles. It''s a practical and thoughtful gift for any photographer!',
    '{"products": [{"id": 202, "title": "Professional Camera Strap", "price": 45.99, "stock_status": "instock", "recommended": true}]}'::jsonb,
    '{"prompt_tokens": 210, "completion_tokens": 75, "total_tokens": 285}'::jsonb,
    'gpt-4',
    NOW() - INTERVAL '3 hours' + INTERVAL '1 minute' + INTERVAL '15 seconds'
FROM conv_data
WHERE NOT EXISTS (
    SELECT 1 FROM messages WHERE conversation_id = conv_data.id AND role = 'assistant' AND content_text LIKE '%Camera Strap%$45.99%'
);

-- ============================================
-- Update message_count to match actual messages
-- ============================================

-- Update message_count for all conversations based on actual message count
UPDATE conversations c
SET message_count = (
    SELECT COUNT(*) 
    FROM messages m 
    WHERE m.conversation_id = c.id
)
WHERE c.site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid;

-- ============================================
-- Verification Queries
-- ============================================

-- Check created conversations
SELECT 
    c.id,
    c.conversation_id,
    c.message_count,
    c.started_at,
    c.last_message_at,
    v.visitor_id,
    COUNT(m.id) as actual_message_count
FROM conversations c
LEFT JOIN visitors v ON c.visitor_id = v.id
LEFT JOIN messages m ON m.conversation_id = c.id
WHERE c.site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'::uuid
GROUP BY c.id, c.conversation_id, c.message_count, c.started_at, c.last_message_at, v.visitor_id
ORDER BY c.started_at DESC;

-- Check message distribution



