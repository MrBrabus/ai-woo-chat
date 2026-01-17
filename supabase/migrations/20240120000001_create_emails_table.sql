-- Migration: Create emails table (DB vNext - Phase 1)
-- Status: STAGING ONLY - DO NOT APPLY TO PRODUCTION
-- Review Required: Yes
-- 
-- This migration creates the emails table for email logging.
-- Replaces the temporary audit_logs-based logging with a dedicated table.
--
-- Rollout Plan:
-- 1. Apply to staging Supabase project
-- 2. Verify RLS policies and query performance
-- 3. Review and approve
-- 4. Apply to production after explicit approval

-- Create emails table
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    to TEXT NOT NULL, -- Comma-separated if multiple recipients
    subject TEXT NOT NULL,
    resend_message_id TEXT, -- Resend API message ID for tracking
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emails_site_id ON emails(site_id);
CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON emails(conversation_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_resend_message_id ON emails(resend_message_id) WHERE resend_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_emails_metadata ON emails USING GIN (metadata);

-- Enable RLS
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all emails (for runtime)
-- This allows the ingestion/chat runtime services to log emails
CREATE POLICY "Service role can manage emails"
    ON emails FOR ALL
    USING (true);

-- RLS Policy: Users can view emails for their tenants
-- This ensures tenant isolation for dashboard users
CREATE POLICY "Users can view emails for their tenants"
    ON emails FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_tenants ut
            JOIN sites s ON s.tenant_id = ut.tenant_id
            WHERE s.id = emails.site_id
            AND ut.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM platform_users
            WHERE user_id = auth.uid()
            AND role = 'super_admin'
        )
    );

-- Add comments for documentation
COMMENT ON TABLE emails IS 'Email logs for tracking sent emails via Resend. Replaces audit_logs-based email logging.';
COMMENT ON COLUMN emails.to IS 'Comma-separated email addresses if multiple recipients';
COMMENT ON COLUMN emails.resend_message_id IS 'Resend API message ID for tracking and webhook integration';
COMMENT ON COLUMN emails.status IS 'Email send status: sent, failed, or pending';
COMMENT ON COLUMN emails.metadata IS 'JSONB metadata about the email (type, template, recipients count, etc.)';
COMMENT ON COLUMN emails.conversation_id IS 'Optional reference to conversation if this is a conversation summary email';
