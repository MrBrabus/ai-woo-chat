/**
 * Email logging service
 * 
 * Logs email sends to database for tracking and audit
 * 
 * DB vNext: Now supports both audit_logs (legacy) and emails table (new)
 * See logger-v2.ts for the new implementation
 * 
 * This file maintains backward compatibility during migration
 */

import { createAdminClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClient();

export interface EmailLog {
  site_id: string;
  conversation_id?: string;
  to: string | string[];
  subject: string;
  resend_message_id?: string;
  status: 'sent' | 'failed' | 'pending';
  error_message?: string;
  metadata?: Record<string, any>;
}

/**
 * Log email to database using audit_logs table (DB LOCK compliance)
 */
export async function logEmail(log: EmailLog): Promise<void> {
  try {
    // Use audit_logs table with action='email_sent' or 'email_failed'
    const action = log.status === 'sent' ? 'email_sent' : log.status === 'failed' ? 'email_failed' : 'email_pending';
    
    const metadata = {
      type: 'email',
      to: Array.isArray(log.to) ? log.to : [log.to],
      subject: log.subject,
      resend_message_id: log.resend_message_id || null,
      status: log.status,
      error_message: log.error_message || null,
      conversation_id: log.conversation_id || null,
      ...(log.metadata || {}),
    };

    const { error } = await supabaseAdmin.from('audit_logs').insert({
      site_id: log.site_id,
      action,
      metadata,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Failed to log email to audit_logs:', error);
      // Don't throw - email logging failures shouldn't break email sending
    }
  } catch (error) {
    console.error('Error logging email:', error);
    // Don't throw - email logging failures shouldn't break email sending
  }
}

/**
 * Get email logs for a site from audit_logs table (DB LOCK compliance)
 */
export async function getEmailLogs(
  siteId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Array<EmailLog & { id: string; created_at: string }>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('site_id', siteId)
      .in('action', ['email_sent', 'email_failed', 'email_pending'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return (data || []).map((row) => {
      const metadata = row.metadata || {};
      return {
        id: row.id,
        site_id: row.site_id,
        conversation_id: metadata.conversation_id || null,
        to: Array.isArray(metadata.to) ? metadata.to : metadata.to ? [metadata.to] : [],
        subject: metadata.subject || '',
        resend_message_id: metadata.resend_message_id || null,
        status: metadata.status || (row.action === 'email_sent' ? 'sent' : row.action === 'email_failed' ? 'failed' : 'pending'),
        error_message: metadata.error_message || null,
        metadata: metadata,
        created_at: row.created_at,
      };
    });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    return [];
  }
}
