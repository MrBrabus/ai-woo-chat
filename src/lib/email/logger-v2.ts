/**
 * Email logging service (v2 - with emails table support)
 * 
 * Supports both audit_logs (legacy) and emails table (new)
 * Feature-flagged to allow gradual migration
 * 
 * DB vNext: Phase 1 - Emails Table
 */

import { createAdminClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClient();

// Feature flag: Use new emails table if available
// Set to false to fall back to audit_logs
const USE_EMAILS_TABLE = process.env.USE_EMAILS_TABLE !== 'false'; // Default: true if env not set

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
 * Log email to database (v2 - supports both tables)
 */
export async function logEmail(log: EmailLog): Promise<void> {
  try {
    if (USE_EMAILS_TABLE) {
      // Try new emails table first
      const { error } = await supabaseAdmin.from('emails').insert({
        site_id: log.site_id,
        conversation_id: log.conversation_id || null,
        to: Array.isArray(log.to) ? log.to.join(',') : log.to,
        subject: log.subject,
        resend_message_id: log.resend_message_id || null,
        status: log.status,
        error_message: log.error_message || null,
        metadata: log.metadata || {},
        created_at: new Date().toISOString(),
      });

      if (error) {
        // If emails table doesn't exist, fall back to audit_logs
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          console.warn('emails table not found, falling back to audit_logs');
          await logEmailToAuditLogs(log);
        } else {
          throw error;
        }
      }
    } else {
      // Explicitly use audit_logs (legacy mode)
      await logEmailToAuditLogs(log);
    }
  } catch (error) {
    console.error('Error logging email:', error);
    // Don't throw - email logging failures shouldn't break email sending
  }
}

/**
 * Log email to audit_logs (legacy method)
 */
async function logEmailToAuditLogs(log: EmailLog): Promise<void> {
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
    throw error;
  }
}

/**
 * Get email logs for a site (v2 - supports both tables)
 */
export async function getEmailLogs(
  siteId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Array<EmailLog & { id: string; created_at: string }>> {
  try {
    if (USE_EMAILS_TABLE) {
      // Try new emails table first
      const { data, error } = await supabaseAdmin
        .from('emails')
        .select('*')
        .eq('site_id', siteId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        // If emails table doesn't exist, fall back to audit_logs
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          console.warn('emails table not found, falling back to audit_logs');
          return getEmailLogsFromAuditLogs(siteId, limit, offset);
        }
        throw error;
      }

      return (data || []).map((row) => ({
        id: row.id,
        site_id: row.site_id,
        conversation_id: row.conversation_id,
        to: row.to.includes(',') ? row.to.split(',').map((e: string) => e.trim()) : row.to,
        subject: row.subject,
        resend_message_id: row.resend_message_id,
        status: row.status,
        error_message: row.error_message,
        metadata: row.metadata,
        created_at: row.created_at,
      }));
    } else {
      // Explicitly use audit_logs (legacy mode)
      return getEmailLogsFromAuditLogs(siteId, limit, offset);
    }
  } catch (error) {
    console.error('Error fetching email logs:', error);
    return [];
  }
}

/**
 * Get email logs from audit_logs (legacy method)
 */
async function getEmailLogsFromAuditLogs(
  siteId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Array<EmailLog & { id: string; created_at: string }>> {
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
}
