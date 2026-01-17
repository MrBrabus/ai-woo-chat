/**
 * Conversation email integration
 * 
 * Handles sending conversation summary emails when conversations end
 */

import { createAdminClient } from '@/lib/supabase/server';
import { getEmailSettings, sendConversationSummaryWithLogging } from './service';

const supabaseAdmin = createAdminClient();

/**
 * Send conversation summary email if enabled
 */
export async function sendConversationSummaryIfEnabled(
  siteId: string,
  conversationId: string,
  recipientEmail: string
): Promise<void> {
  try {
    // Get email settings
    const emailSettings = await getEmailSettings(siteId);

    // Check if conversation summaries are enabled
    if (!emailSettings.enabled || !emailSettings.sendConversationSummaries) {
      return; // Email service disabled or summaries disabled
    }

    // Get conversation messages
    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id, site_id')
      .eq('site_id', siteId)
      .eq('conversation_id', conversationId)
      .single();

    if (!conversation) {
      console.warn('Conversation not found for email summary:', conversationId);
      return;
    }

    // Get messages
    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('role, content_text')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
      return; // No messages to summarize
    }

    // Get site name
    const { data: site } = await supabaseAdmin
      .from('sites')
      .select('site_name, site_url')
      .eq('id', siteId)
      .single();

    const siteName = site?.site_name || 'Store';
    const conversationUrl = site?.site_url
      ? `${site.site_url}/dashboard/conversations/${conversationId}`
      : undefined;

    // Format messages for email
    const formattedMessages = messages
      .filter((msg) => msg.content_text)
      .map((msg) => ({
        role: msg.role,
        content: msg.content_text || '',
      }));

    // Send to configured recipients or provided email
    const recipients = emailSettings.summaryRecipients?.length
      ? emailSettings.summaryRecipients
      : [recipientEmail];

    // Send email to each recipient
    for (const recipient of recipients) {
      if (recipient) {
        await sendConversationSummaryWithLogging(
          siteId,
          conversationId,
          recipient,
          siteName,
          formattedMessages,
          conversationUrl
        );
      }
    }
  } catch (error) {
    console.error('Error sending conversation summary email:', error);
    // Don't throw - email failures shouldn't break conversation flow
  }
}
