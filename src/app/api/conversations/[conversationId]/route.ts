/**
 * GET /api/conversations/[conversationId]
 * Get conversation details with messages
 * 
 * Requires authentication (dashboard users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { conversationId: string } }
) {
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
    const conversationId = params.conversationId;

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

    // Get conversation - conversationId can be either UUID (id) or string (conversation_id)
    // First try as UUID (id), then as string (conversation_id)
    let conversation: any = null;
    let conversationError: any = null;

    // Try to match by UUID (id) first
    const { data: convById, error: errorById } = await supabaseAdmin
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
      .eq('id', conversationId)
      .single();

    if (convById && !errorById) {
      conversation = convById;
    } else {
      // If not found by ID, try by conversation_id
      const { data: convByConversationId, error: errorByConversationId } = await supabaseAdmin
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
        .eq('conversation_id', conversationId)
        .single();

      conversation = convByConversationId;
      conversationError = errorByConversationId;
    }

    if (conversationError || !conversation) {
      return NextResponse.json(
        {
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found',
          },
        },
        { status: 404 }
      );
    }

    // Get messages for this conversation
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true });

    if (messagesError) {
      throw messagesError;
    }

    // Format response
    const formattedConversation = {
      id: conversation.id,
      conversation_id: conversation.conversation_id,
      site_id: conversation.site_id,
      visitor_id: conversation.visitor_id,
      last_message_at: conversation.last_message_at,
      message_count: conversation.message_count || 0,
      created_at: conversation.created_at,
      visitor: conversation.visitors ? {
        visitor_id: conversation.visitors.visitor_id,
        first_seen_at: conversation.visitors.first_seen_at,
        last_seen_at: conversation.visitors.last_seen_at,
      } : null,
      messages: (messages || []).map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content_text: msg.content_text,
        content_json: msg.content_json,
        token_usage: msg.token_usage,
        created_at: msg.created_at,
        metadata: msg.metadata,
      })),
    };

    return NextResponse.json(formattedConversation);
  } catch (error) {
    console.error('Conversation GET error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch conversation',
        },
      },
      { status: 500 }
    );
  }
}
