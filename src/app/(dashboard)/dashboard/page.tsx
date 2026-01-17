/**
 * Dashboard home page - Modern design
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isSuperAdmin } from '@/lib/auth/check-super-admin';
import Link from 'next/link';

async function getSuperAdminStats() {
  try {
    const supabaseAdmin = createAdminClient();

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);
    const last30DaysISO = last30Days.toISOString();

    // Get yesterday's date for comparison
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString();

    // Fetch all stats in parallel
    const [
      tenantsResult,
      licensesResult,
      sitesResult,
      conversationsResult,
      conversationsTodayResult,
      messagesTodayResult,
      messagesYesterdayResult,
      usageResult,
    ] = await Promise.all([
      // Total tenants
      supabaseAdmin
        .from('tenants')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      
      // Total active licenses
      supabaseAdmin
        .from('licenses')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      
      // Total active sites
      supabaseAdmin
        .from('sites')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      
      // Total conversations (all time)
      supabaseAdmin
        .from('conversations')
        .select('*', { count: 'exact', head: true }),
      
      // Conversations today
      supabaseAdmin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayISO),
      
      // Messages today
      supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayISO),
      
      // Messages yesterday
      supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', yesterdayISO)
        .lt('created_at', todayISO),
      
      // Token usage (last 30 days)
      supabaseAdmin
        .from('usage_events')
        .select('total_tokens')
        .gte('created_at', last30DaysISO),
    ]);

    const totalTokens = (usageResult.data || []).reduce(
      (sum: number, event: any) => sum + (event.total_tokens || 0),
      0
    );

    const messagesToday = messagesTodayResult.count || 0;
    const messagesYesterday = messagesYesterdayResult.count || 0;
    const messageChange = messagesYesterday > 0
      ? (((messagesToday - messagesYesterday) / messagesYesterday) * 100)
      : messagesToday > 0 ? 100.0 : 0.0;
    const messageChangeType = messagesToday >= messagesYesterday ? 'positive' : 'negative';

    return {
      total_tenants: tenantsResult.count || 0,
      active_licenses: licensesResult.count || 0,
      active_sites: sitesResult.count || 0,
      total_conversations: conversationsResult.count || 0,
      conversations_today: conversationsTodayResult.count || 0,
      messages_today: messagesToday,
      message_change: messageChange.toFixed(1),
      message_change_type: messageChangeType,
      total_tokens_30d: totalTokens,
    };
  } catch (error) {
    console.error('Error fetching super admin stats:', error);
    return null;
  }
}

async function getDashboardStats(userId: string) {
  try {
    const supabase = await createClient();
    
    // Get user's tenant
    const { data: userTenants, error: tenantError } = await supabase
      .from('user_tenants')
      .select('tenant_id')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (tenantError || !userTenants) {
      return null;
    }

    const supabaseAdmin = createAdminClient();

    // Get all sites for this tenant
    const { data: sites, error: sitesError } = await supabaseAdmin
      .from('sites')
      .select('id, status')
      .eq('tenant_id', userTenants.tenant_id);

    if (sitesError) {
      return null;
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
      return null;
    }

    // Get messages today
    const { count: messagesToday, error: messagesError } = await supabaseAdmin
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .in('site_id', siteIds)
      .gte('created_at', todayISO);

    if (messagesError) {
      return null;
    }

    // Get conversations today
    const { count: conversationsToday, error: convTodayError } = await supabaseAdmin
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .in('site_id', siteIds)
      .gte('created_at', todayISO);

    if (convTodayError) {
      return null;
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
      return null;
    }

    // Calculate response rate (assistant messages / user messages)
    const { data: messages, error: messagesDataError } = await supabaseAdmin
      .from('messages')
      .select('role')
      .in('site_id', siteIds)
      .gte('created_at', todayISO);

    if (messagesDataError) {
      return null;
    }

    const userMessages = messages?.filter(m => m.role === 'user').length || 0;
    const assistantMessages = messages?.filter(m => m.role === 'assistant').length || 0;
    const responseRate = userMessages > 0 
      ? ((assistantMessages / userMessages) * 100)
      : 100.0;

    // Calculate message change
    const messageChange = messagesYesterday > 0
      ? (((messagesToday || 0) - messagesYesterday) / messagesYesterday * 100)
      : messagesToday > 0 ? 100.0 : 0.0;
    const messageChangeType = (messagesToday || 0) >= messagesYesterday ? 'positive' : 'negative';

    return {
      total_conversations: totalConversations || 0,
      active_sites: activeSites,
      messages_today: messagesToday || 0,
      conversations_today: conversationsToday || 0,
      response_rate: responseRate,
      message_change: messageChange.toFixed(1),
      message_change_type: messageChangeType,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return null;
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is super admin
  const admin = await isSuperAdmin(user.id);
  const statsData = admin 
    ? await getSuperAdminStats()
    : await getDashboardStats(user.id);

  // Super admin stats
  const superAdminStats = admin ? [
    {
      name: 'Total Tenants',
      value: statsData?.total_tenants?.toLocaleString() || '0',
      change: '',
      changeType: 'positive' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      gradient: 'from-blue-500 to-cyan-500',
      href: '/admin/tenants',
    },
    {
      name: 'Active Licenses',
      value: statsData?.active_licenses?.toLocaleString() || '0',
      change: '',
      changeType: 'positive' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      gradient: 'from-purple-500 to-pink-500',
      href: '/admin/licenses',
    },
    {
      name: 'Active Sites',
      value: statsData?.active_sites?.toLocaleString() || '0',
      change: '',
      changeType: 'positive' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      gradient: 'from-indigo-500 to-purple-500',
    },
    {
      name: 'Total Conversations',
      value: statsData?.total_conversations?.toLocaleString() || '0',
      change: statsData?.conversations_today ? `+${statsData.conversations_today} today` : '0 today',
      changeType: 'positive' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      gradient: 'from-green-500 to-emerald-500',
      href: '/admin/conversations',
    },
    {
      name: 'Messages Today',
      value: statsData?.messages_today?.toLocaleString() || '0',
      change: statsData?.message_change ? `${statsData.message_change_type === 'positive' ? '+' : ''}${statsData.message_change}%` : '0%',
      changeType: (statsData?.message_change_type || 'positive') as 'positive' | 'negative',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      gradient: 'from-orange-500 to-red-500',
    },
    {
      name: 'Tokens (30d)',
      value: statsData?.total_tokens_30d ? `${(statsData.total_tokens_30d / 1000000).toFixed(1)}M` : '0',
      change: '',
      changeType: 'positive' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      gradient: 'from-yellow-500 to-orange-500',
      href: '/admin/usage',
    },
  ] : null;

  // Regular user stats
  const regularStats = [
    {
      name: 'Total Conversations',
      value: statsData?.total_conversations?.toLocaleString() || '0',
      change: statsData?.conversations_today ? `+${statsData.conversations_today} today` : '0 today',
      changeType: 'positive' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'Active Sites',
      value: statsData?.active_sites?.toString() || '0',
      change: '',
      changeType: 'positive' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      name: 'Messages Today',
      value: statsData?.messages_today?.toLocaleString() || '0',
      change: statsData?.message_change ? `${statsData.message_change_type === 'positive' ? '+' : ''}${statsData.message_change}%` : '0%',
      changeType: (statsData?.message_change_type || 'positive') as 'positive' | 'negative',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      gradient: 'from-indigo-500 to-purple-500',
    },
    {
      name: 'Response Rate',
      value: statsData?.response_rate ? `${statsData.response_rate.toFixed(1)}%` : '100.0%',
      change: '',
      changeType: 'positive' as const,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      gradient: 'from-green-500 to-emerald-500',
    },
  ];

  // Use super admin stats if admin, otherwise regular stats
  const stats = admin ? superAdminStats || [] : regularStats;

  // Super admin quick actions
  const superAdminQuickActions = admin ? [
    {
      name: 'View All Licenses',
      description: 'Manage all licenses and customers',
      href: '/admin/licenses',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
        </svg>
      ),
      color: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'View All Conversations',
      description: 'Browse conversations across all tenants',
      href: '/admin/conversations',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: 'Usage Analytics',
      description: 'Monitor token usage and API requests',
      href: '/admin/usage',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'from-indigo-500 to-purple-500',
    },
    {
      name: 'System Logs',
      description: 'View system logs and errors',
      href: '/admin/logs',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'from-gray-500 to-slate-500',
    },
  ] : null;

  // Regular user quick actions
  const regularQuickActions = [
    {
      name: 'View Conversations',
      description: 'Browse and manage all conversations',
      href: '/dashboard/conversations',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      ),
      color: 'from-blue-500 to-cyan-500',
    },
    {
      name: 'Manage Sites',
      description: 'Configure and manage your sites',
      href: '/dashboard/sites',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      color: 'from-purple-500 to-pink-500',
    },
    {
      name: 'View Analytics',
      description: 'Track performance and insights',
      href: '/dashboard/analytics',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'from-indigo-500 to-purple-500',
    },
    {
      name: 'Settings',
      description: 'Configure voice, sales, and more',
      href: '/dashboard/settings/voice',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'from-gray-500 to-slate-500',
    },
  ];

  // Use super admin quick actions if admin, otherwise regular quick actions
  const quickActions = admin ? superAdminQuickActions || [] : regularQuickActions;

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Welcome Section */}
      <div className="card-modern p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {user.email?.split('@')[0]}! 👋
            </h1>
            <p className="text-gray-600">
              {admin 
                ? "Platform-wide overview and statistics for AI Woo Chat."
                : "Here's what's happening with your AI Woo Chat platform today."
              }
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${admin ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
        {stats.map((stat, index) => {
          const StatCard = (
            <div className="card-modern p-6 group hover:scale-105 transition-transform duration-200">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} text-white shadow-lg`}>
                  {stat.icon}
                </div>
                <span
                  className={`text-sm font-semibold ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {stat.change}
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
              <p className="text-sm text-gray-600">{stat.name}</p>
            </div>
          );

          // Make stat card clickable if it has href (super admin stats)
          if (stat.href && admin) {
            return (
              <Link key={index} href={stat.href} className="cursor-pointer">
                {StatCard}
              </Link>
            );
          }

          return <div key={index}>{StatCard}</div>;
        })}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              href={action.href}
              className="card-modern p-6 group hover:scale-105 transition-all duration-200 hover:shadow-2xl"
            >
              <div className={`inline-flex p-4 rounded-xl bg-gradient-to-br ${action.color} text-white mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                {action.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.name}</h3>
              <p className="text-sm text-gray-600">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

