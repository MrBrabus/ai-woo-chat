/**
 * GET /api/analytics
 * Get analytics data for dashboard
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
    const days = parseInt(url.searchParams.get('days') || '30');

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

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateISO = startDate.toISOString();

    // Get conversation statistics
    const { data: conversations, error: conversationsError } = await supabaseAdmin
      .from('conversations')
      .select('id, created_at, message_count')
      .eq('site_id', siteId)
      .gte('created_at', startDateISO);

    if (conversationsError) {
      throw conversationsError;
    }

    // Get message statistics
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('id, created_at, role, token_usage')
      .eq('site_id', siteId)
      .gte('created_at', startDateISO);

    if (messagesError) {
      throw messagesError;
    }

    // Get chat events (product views, clicks, etc.)
    const { data: chatEvents, error: eventsError } = await supabaseAdmin
      .from('chat_events')
      .select('id, event_type, created_at, payload')
      .eq('site_id', siteId)
      .gte('created_at', startDateISO);

    if (eventsError) {
      throw eventsError;
    }

    // Get usage statistics
    const { data: usageStats, error: usageError } = await supabaseAdmin
      .from('usage_daily')
      .select('date, total_tokens, chat_requests')
      .eq('site_id', siteId)
      .gte('date', startDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (usageError) {
      throw usageError;
    }

    // Calculate statistics
    const totalConversations = conversations?.length || 0;
    const totalMessages = messages?.length || 0;
    const userMessages = messages?.filter(m => m.role === 'user').length || 0;
    const assistantMessages = messages?.filter(m => m.role === 'assistant').length || 0;

    // Calculate total tokens
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    messages?.forEach(msg => {
      if (msg.token_usage) {
        const usage = typeof msg.token_usage === 'object' ? msg.token_usage : JSON.parse(msg.token_usage as any);
        totalTokens += usage.total_tokens || 0;
        promptTokens += usage.prompt_tokens || 0;
        completionTokens += usage.completion_tokens || 0;
      }
    });

    // Calculate chat events
    const productViews = chatEvents?.filter(e => e.event_type === 'view').length || 0;
    const productClicks = chatEvents?.filter(e => e.event_type === 'click').length || 0;
    const addToCart = chatEvents?.filter(e => e.event_type === 'add_to_cart').length || 0;

    // Calculate daily trends
    const dailyStats = usageStats?.map(stat => ({
      date: stat.date,
      tokens: stat.total_tokens || 0,
      requests: stat.chat_requests || 0,
    })) || [];

    // Group conversations by day
    const conversationsByDay: Record<string, number> = {};
    conversations?.forEach(conv => {
      const date = new Date(conv.created_at).toISOString().split('T')[0];
      conversationsByDay[date] = (conversationsByDay[date] || 0) + 1;
    });

    // Group messages by day
    const messagesByDay: Record<string, number> = {};
    messages?.forEach(msg => {
      const date = new Date(msg.created_at).toISOString().split('T')[0];
      messagesByDay[date] = (messagesByDay[date] || 0) + 1;
    });

    return NextResponse.json({
      period: {
        days,
        start_date: startDateISO,
        end_date: new Date().toISOString(),
      },
      overview: {
        total_conversations: totalConversations,
        total_messages: totalMessages,
        user_messages: userMessages,
        assistant_messages: assistantMessages,
        total_tokens: totalTokens,
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        product_views: productViews,
        product_clicks: productClicks,
        add_to_cart: addToCart,
      },
      daily: {
        conversations: conversationsByDay,
        messages: messagesByDay,
        usage: dailyStats,
      },
    });
  } catch (error) {
    console.error('Analytics GET error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch analytics',
        },
      },
      { status: 500 }
    );
  }
}
