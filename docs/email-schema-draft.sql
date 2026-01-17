-- DRAFT: Email Schema (DO NOT APPLY - DB LOCKED)
-- This is a draft schema for future implementation after DB unlock
-- 
-- When DB is unlocked (after To-Do #14 completion):
-- 1. Review this schema
-- 2. Test on staging Supabase project
-- 3. Apply to production after approval
--
-- Current implementation uses audit_logs table for email logging

-- Create emails table for email logging
CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    to TEXT NOT NULL, -- Comma-separated if multiple recipients
    subject TEXT NOT NULL,
    resend_message_id TEXT, -- Resend API message ID
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_emails_site_id ON emails(site_id);
CREATE INDEX IF NOT EXISTS idx_emails_conversation_id ON emails(conversation_id);
CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at);
CREATE INDEX IF NOT EXISTS idx_emails_resend_message_id ON emails(resend_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_metadata ON emails USING GIN (metadata);

-- Enable RLS
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Service role can manage all emails (for runtime)
CREATE POLICY "Service role can manage emails"
    ON emails FOR ALL
    USING (true);

-- RLS Policy: Users can view emails for their tenants
CREATE POLICY "Users can view emails for their tenants"
    ON emails FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_tenants ut
            JOIN sites s ON s.tenant_id = ut.tenant_id
            WHERE s.id = emails.site_id
            AND ut.user_id = auth.uid()
        )
    );

-- Add comment
COMMENT ON TABLE emails IS 'Email logs for tracking sent emails via Resend';
COMMENT ON COLUMN emails.to IS 'Comma-separated email addresses if multiple recipients';
COMMENT ON COLUMN emails.resend_message_id IS 'Resend API message ID for tracking';
COMMENT ON COLUMN emails.metadata IS 'JSONB metadata about the email (type, template, etc.)';
