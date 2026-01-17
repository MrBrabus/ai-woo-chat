-- SQL Verification Queries for To-do #2
-- Run these queries in Supabase Dashboard SQL Editor to verify schema completion
-- Project: AI Woo Chat (drmuwsxyvvfivdfsyydy)

-- ============================================
-- A) List all public tables
-- ============================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Expected result: Should show all tables including:
-- audit_logs, chat_events, conversations, embeddings, ingestion_events,
-- licenses, messages, platform_users, settings, settings_history, sites,
-- tenants, usage_daily, usage_events, user_tenants, visitors

-- ============================================
-- B) Confirm pgvector extension
-- ============================================
SELECT extname, extversion
FROM pg_extension
WHERE extname = 'vector';

-- Expected result: extname='vector', extversion should be present

-- ============================================
-- C) Confirm embeddings vector column
-- ============================================
SELECT
  table_name, column_name, udt_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='embeddings'
  AND column_name='embedding';

-- Expected result: table_name='embeddings', column_name='embedding', udt_name='vector'

-- ============================================
-- D) Confirm embeddings indexes
-- ============================================
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname='public'
  AND tablename='embeddings'
ORDER BY indexname;

-- Expected result: Should show multiple indexes including:
-- - idx_embeddings_vector (HNSW index)
-- - idx_embeddings_site_id, idx_embeddings_tenant_id, etc.

-- ============================================
-- E) Confirm RLS enabled on key tables
-- ============================================
SELECT relname, relrowsecurity
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE nspname='public'
  AND relname IN ('tenants','sites','licenses','conversations','messages','usage_events','usage_daily')
ORDER BY relname;

-- Expected result: All tables should have relrowsecurity=true

-- ============================================
-- F) List RLS policies (sample)
-- ============================================
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname='public'
ORDER BY tablename, policyname
LIMIT 50;

-- Expected result: Should show multiple RLS policies for tenant isolation
