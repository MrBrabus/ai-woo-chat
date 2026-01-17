/**
 * POST /api/chat/events
 * Chat events endpoint with runtime validation
 * Records user events (view, click, add_to_cart)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRuntimeValidation } from '@/middleware/runtime-validation';
import { createAdminClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClient();

async function eventsHandler(
  req: NextRequest,
  site_id: string,
  site: any,
  license: any
): Promise<Response> {
  try {
    // Body may have been read by middleware, try to parse it
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body already consumed, use empty object
      // site_id is already provided as parameter
    }
    const { visitor_id, conversation_id, type, payload } = body;

    if (!visitor_id || !type) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'visitor_id and type are required',
          },
        },
        { status: 400 }
      );
    }

    // Validate event type
    const validTypes = ['view', 'click', 'add_to_cart'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_FORMAT',
            message: `type must be one of: ${validTypes.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Get visitor and conversation DB IDs
    const { data: visitor } = await supabaseAdmin
      .from('visitors')
      .select('id')
      .eq('site_id', site_id)
      .eq('visitor_id', visitor_id)
      .single();

    if (!visitor) {
      return NextResponse.json(
        {
          error: {
            code: 'VISITOR_NOT_FOUND',
            message: 'Visitor not found',
          },
        },
        { status: 404 }
      );
    }

    let conversationDbId: string | null = null;
    if (conversation_id) {
      const { data: conversation } = await supabaseAdmin
        .from('conversations')
        .select('id')
        .eq('site_id', site_id)
        .eq('conversation_id', conversation_id)
        .single();

      if (conversation) {
        conversationDbId = conversation.id;
      }
    }

    // Insert event into chat_events table
    const { error } = await supabaseAdmin.from('chat_events').insert({
      site_id,
      visitor_id: visitor.id,
      conversation_id: conversationDbId,
      event_type: type,
      payload: payload || {},
      created_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to log event: ${error.message}`);
    }

    return NextResponse.json({
      status: 'recorded',
    });
  } catch (error) {
    console.error('Events error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to record event',
        },
      },
      { status: 500 }
    );
  }
}

// Export with runtime validation
export const POST = withRuntimeValidation(eventsHandler);
