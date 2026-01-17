/**
 * Email service
 * 
 * Main email service that combines Resend client with logging
 */

import { sendEmail, sendConversationSummaryEmail, type EmailOptions, type EmailResult } from './resend-client';
import { logEmail, type EmailLog } from './logger';
import { generateRequestId } from '@/lib/utils/logger';

export interface SendEmailParams extends EmailOptions {
  siteId: string;
  conversationId?: string;
  metadata?: Record<string, any>;
}

/**
 * Send email with automatic logging
 */
export async function sendEmailWithLogging(params: SendEmailParams): Promise<EmailResult> {
  const { siteId, conversationId, metadata, ...emailOptions } = params;
  const requestId = generateRequestId();

  // Send email via Resend (with retry)
  const result = await sendEmail(emailOptions, requestId);

  // Log email (regardless of success/failure)
  await logEmail({
    site_id: siteId,
    conversation_id: conversationId,
    to: emailOptions.to,
    subject: emailOptions.subject,
    resend_message_id: result.messageId,
    status: result.success ? 'sent' : 'failed',
    error_message: result.error,
    metadata: metadata || {},
  });

  return result;
}

/**
 * Send conversation summary email with logging
 */
export async function sendConversationSummaryWithLogging(
  siteId: string,
  conversationId: string,
  to: string,
  siteName: string,
  messages: Array<{ role: string; content: string }>,
  conversationUrl?: string
): Promise<EmailResult> {
  const requestId = generateRequestId();

  // Send email (with retry)
  const result = await sendConversationSummaryEmail(
    to,
    conversationId,
    siteName,
    messages,
    conversationUrl,
    requestId
  );

  // Log email
  await logEmail({
    site_id: siteId,
    conversation_id: conversationId,
    to,
    subject: `Chat Conversation Summary - ${siteName}`,
    resend_message_id: result.messageId,
    status: result.success ? 'sent' : 'failed',
    error_message: result.error,
    metadata: {
      type: 'conversation_summary',
      message_count: messages.length,
      conversation_url: conversationUrl,
    },
  });

  return result;
}

/**
 * Get email settings for a site
 */
export async function getEmailSettings(siteId: string): Promise<{
  enabled: boolean;
  fromEmail?: string;
  replyTo?: string;
  sendConversationSummaries: boolean;
  summaryRecipients?: string[];
}> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('site_id', siteId)
      .eq('key', 'email')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return defaults if no settings found
      return {
        enabled: false,
        sendConversationSummaries: false,
      };
    }

    const emailSettings = data.value as any;
    return {
      enabled: emailSettings.enabled ?? false,
      fromEmail: emailSettings.from_email,
      replyTo: emailSettings.reply_to,
      sendConversationSummaries: emailSettings.send_conversation_summaries ?? false,
      summaryRecipients: emailSettings.summary_recipients || [],
    };
  } catch (error) {
    console.error('Error fetching email settings:', error);
    return {
      enabled: false,
      sendConversationSummaries: false,
    };
  }
}

/**
 * Update email settings for a site
 */
export async function updateEmailSettings(
  siteId: string,
  tenantId: string,
  settings: {
    enabled?: boolean;
    fromEmail?: string;
    replyTo?: string;
    sendConversationSummaries?: boolean;
    summaryRecipients?: string[];
  }
): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();

    // Get current settings
    const { data: existing } = await supabaseAdmin
      .from('settings')
      .select('value, version')
      .eq('site_id', siteId)
      .eq('key', 'email')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const currentSettings = existing?.value || {};
    const newSettings = {
      ...currentSettings,
      ...settings,
    };

    // Deactivate old settings
    if (existing) {
      await supabaseAdmin
        .from('settings')
        .update({ is_active: false })
        .eq('site_id', siteId)
        .eq('key', 'email')
        .eq('is_active', true);
    }

    // Insert new settings version
    const { error } = await supabaseAdmin.from('settings').insert({
      site_id: siteId,
      tenant_id: tenantId,
      key: 'email',
      value: newSettings,
      version: (existing?.version || 0) + 1,
      is_active: true,
    });

    if (error) {
      throw new Error(`Failed to update email settings: ${error.message}`);
    }
  } catch (error) {
    console.error('Error updating email settings:', error);
    throw error;
  }
}
