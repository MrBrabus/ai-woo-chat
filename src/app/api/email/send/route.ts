/**
 * POST /api/email/send
 * Email sending endpoint
 * 
 * Sends emails via Resend with logging
 * Requires authentication (dashboard users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmailWithLogging } from '@/lib/email/service';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { site_id, conversation_id, to, subject, html, text, from, reply_to, metadata } = body;

    // Validate required fields
    if (!site_id || !to || !subject) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'site_id, to, and subject are required',
          },
        },
        { status: 400 }
      );
    }

    // Verify user has access to this site
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();

    const { data: site, error: siteError } = await supabaseAdmin
      .from('sites')
      .select('tenant_id')
      .eq('id', site_id)
      .single();

    if (siteError || !site) {
      return NextResponse.json(
        {
          error: {
            code: 'SITE_NOT_FOUND',
            message: 'Site not found',
          },
        },
        { status: 404 }
      );
    }

    // TODO: Verify user has access to this tenant (when user_tenants is implemented)
    // For now, allow if authenticated

    // Send email with logging
    const result = await sendEmailWithLogging({
      siteId: site_id,
      conversationId: conversation_id,
      to,
      subject,
      html,
      text,
      from,
      replyTo: reply_to,
      metadata,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_SEND_FAILED',
            message: result.error || 'Failed to send email',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message_id: result.messageId,
    });
  } catch (error) {
    console.error('Email send error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to send email',
        },
      },
      { status: 500 }
    );
  }
}
