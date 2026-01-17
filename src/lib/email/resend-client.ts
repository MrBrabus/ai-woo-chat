/**
 * Resend email service client
 * 
 * Handles email sending via Resend API with logging
 * Hardened with retry logic and structured logging
 */

import { Resend } from 'resend';
import { withRetry, OPENAI_RETRY_OPTIONS } from '@/lib/utils/retry';
import { createLogger, logResendFailure, generateRequestId } from '@/lib/utils/logger';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send email via Resend (with retry)
 */
export async function sendEmail(options: EmailOptions, requestId?: string): Promise<EmailResult> {
  const logger = createLogger({ request_id: requestId || generateRequestId() });

  try {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const from = options.from || process.env.RESEND_FROM_EMAIL || 'noreply@aiwoochat.com';

    const result = await withRetry(
      async () => {
        return await resend.emails.send({
          from,
          to: Array.isArray(options.to) ? options.to : [options.to],
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
          cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
          bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
          tags: options.tags,
        });
      },
      {
        ...OPENAI_RETRY_OPTIONS, // Reuse OpenAI retry config (429, 5xx)
        retryableErrors: (error: any) => {
          // Retry on 429, 5xx, and network errors
          if (error?.status === 429) return true;
          if (error?.status >= 500 && error?.status < 600) return true;
          if (error?.message?.includes('timeout') || error?.message?.includes('network')) return true;
          return false;
        },
      }
    );

    if (result.error) {
      logResendFailure(
        logger,
        new Error(result.error.message || 'Unknown Resend error'),
        {
          to: Array.isArray(options.to) ? options.to.join(',') : options.to,
          subject: options.subject,
        }
      );
      return {
        success: false,
        error: result.error.message || 'Unknown Resend error',
      };
    }

    logger.info('Email sent successfully', {
      message_id: result.data?.id,
      to: Array.isArray(options.to) ? options.to.join(',') : options.to,
      subject: options.subject,
    });

    return {
      success: true,
      messageId: result.data?.id,
    };
  } catch (error) {
    logResendFailure(
      logger,
      error instanceof Error ? error : new Error('Unknown error'),
      {
        to: Array.isArray(options.to) ? options.to.join(',') : options.to,
        subject: options.subject,
      }
    );
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send conversation summary email
 */
export async function sendConversationSummaryEmail(
  to: string,
  conversationId: string,
  siteName: string,
  messages: Array<{ role: string; content: string }>,
  conversationUrl?: string,
  requestId?: string
): Promise<EmailResult> {
  const subject = `Chat Conversation Summary - ${siteName}`;

  // Build HTML email
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #667eea;">Chat Conversation Summary</h2>
        <p>Here's a summary of your recent chat conversation with ${siteName}:</p>
        
        <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 16px; margin: 20px 0;">
          ${messages
            .map(
              (msg) => `
            <div style="margin-bottom: 16px;">
              <strong style="color: #667eea;">${msg.role === 'user' ? 'You' : 'Assistant'}:</strong>
              <p style="margin: 4px 0 0 0;">${msg.content.replace(/\n/g, '<br>')}</p>
            </div>
          `
            )
            .join('')}
        </div>
        
        ${conversationUrl ? `<p><a href="${conversationUrl}" style="color: #667eea; text-decoration: none;">View full conversation →</a></p>` : ''}
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 12px;">This is an automated email from ${siteName}.</p>
      </body>
    </html>
  `;

  // Build plain text version
  const text = `
Chat Conversation Summary

Here's a summary of your recent chat conversation with ${siteName}:

${messages
  .map((msg) => `${msg.role === 'user' ? 'You' : 'Assistant'}: ${msg.content}`)
  .join('\n\n')}

${conversationUrl ? `View full conversation: ${conversationUrl}` : ''}

---
This is an automated email from ${siteName}.
  `.trim();

  return sendEmail(
    {
      to,
      subject,
      html,
      text,
    },
    requestId
  );
}
