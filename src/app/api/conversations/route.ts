/**
 * GET /api/conversations
 * Get conversations for a site
 * 
 * Requires authentication (dashboard users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
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

    const url = new URL(req.url);
    const siteId = url.searchParams.get('site_id');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    if (!siteId) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'site_id is required',
          },
        },
        { status: 400 }
      );
    }

    // Verify user has access to this site
    const supabaseAdmin = createAdminClient();

    const { data: site, error: siteError } = await supabaseAdmin
      .from('sites')
      .select('tenant_id')
      .eq('id', siteId)
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

    // Get conversations with visitor info
    const { data: conversations, error: conversationsError } = await supabaseAdmin
      .from('conversations')
      .select(`
        id,
        conversation_id,
        site_id,
        visitor_id,
        last_message_at,
        message_count,
        created_at,
        visitors!inner (
          visitor_id,
          first_seen_at,
          last_seen_at
        )
      `)
      .eq('site_id', siteId)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (conversationsError) {
      throw conversationsError;
    }

    // Format response
    const formattedConversations = (conversations || []).map((conv: any) => ({
      id: conv.id,
      conversation_id: conv.conversation_id,
      site_id: conv.site_id,
      visitor_id: conv.visitor_id,
      last_message_at: conv.last_message_at,
      message_count: conv.message_count || 0,
      created_at: conv.created_at,
      visitor: conv.visitors ? {
        visitor_id: conv.visitors.visitor_id,
        first_seen_at: conv.visitors.first_seen_at,
        last_seen_at: conv.visitors.last_seen_at,
      } : null,
    }));

    return NextResponse.json({
      conversations: formattedConversations,
      pagination: {
        limit,
        offset,
        total: formattedConversations.length, // Approximate
      },
    });
  } catch (error) {
    console.error('Conversations GET error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch conversations',
        },
      },
      { status: 500 }
    );
  }
}
