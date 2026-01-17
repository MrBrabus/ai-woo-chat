/**
 * GET /api/dashboard/stats
 * Get dashboard statistics for the authenticated user
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
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

    // Get user's tenant
    const { data: userTenants, error: tenantError } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (tenantError || !userTenants) {
      return NextResponse.json(
        {
          error: {
            code: 'TENANT_NOT_FOUND',
            message: 'No tenant found for user',
          },
        },
        { status: 404 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Get all sites for this tenant
    const { data: sites, error: sitesError } = await supabaseAdmin
      .from('sites')
      .select('id, status')
      .eq('tenant_id', userTenants.tenant_id);

    if (sitesError) {
      throw sitesError;
    }

    const siteIds = sites?.map(s => s.id) || [];
    const activeSites = sites?.filter(s => s.status === 'active').length || 0;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Get total conversations (all time)
    const { count: totalConversations, error: convError } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .in('site_id', siteIds);

    if (convError) {
      throw convError;
    }

    // Get messages today
    const { count: messagesToday, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('site_id', siteIds)
      .gte('created_at', todayISO);

    if (messagesError) {
      throw messagesError;
    }

    // Get conversations today
    const { count: conversationsToday, error: convTodayError } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .in('site_id', siteIds)
      .gte('created_at', todayISO);

    if (convTodayError) {
      throw convTodayError;
    }

    // Get yesterday's date for comparison
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString();

    // Get messages yesterday
    const { count: messagesYesterday, error: messagesYesterdayError } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('site_id', siteIds)
      .gte('created_at', yesterdayISO)
      .lt('created_at', todayISO);

    if (messagesYesterdayError) {
      throw messagesYesterdayError;
    }

    // Calculate response rate (assistant messages / user messages)
    const { data: messages, error: messagesDataError } = await supabaseAdmin
      .from('messages')
      .select('role')
      .in('site_id', siteIds)
      .gte('created_at', todayISO);

    if (messagesDataError) {
      throw messagesDataError;
    }

    const userMessages = messages?.filter(m => m.role === 'user').length || 0;
    const assistantMessages = messages?.filter(m => m.role === 'assistant').length || 0;
    const responseRate = userMessages > 0 
      ? ((assistantMessages / userMessages) * 100).toFixed(1)
      : '100.0';

    // Calculate message change
    const messageChange = messagesYesterday > 0
      ? (((messagesToday || 0) - messagesYesterday) / messagesYesterday * 100).toFixed(1)
      : messagesToday > 0 ? '100.0' : '0.0';
    const messageChangeType = (messagesToday || 0) >= messagesYesterday ? 'positive' : 'negative';

    return NextResponse.json({
      total_conversations: totalConversations || 0,
      active_sites: activeSites,
      messages_today: messagesToday || 0,
      conversations_today: conversationsToday || 0,
      response_rate: parseFloat(responseRate),
      message_change: messageChange,
      message_change_type: messageChangeType,
    });
  } catch (error) {
    console.error('Dashboard stats GET error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch dashboard stats',
        },
      },
      { status: 500 }
    );
  }
}
