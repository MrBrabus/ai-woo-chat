/**
 * GET /api/notifications
 * Get notifications for the authenticated user
 * 
 * Notifications include:
 * - License expiration warnings
 * - Usage limit warnings
 * - Site status issues
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';

export interface Notification {
  id: string;
  type: 'license_expiring' | 'license_expired' | 'usage_limit' | 'site_inactive' | 'site_disabled';
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  action_url?: string;
  action_label?: string;
  created_at: string;
}

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
      return NextResponse.json({ notifications: [] });
    }

    const supabaseAdmin = createAdminClient();
    const notifications: Notification[] = [];

    // Get all sites with licenses for this tenant
    const { data: sites, error: sitesError } = await supabaseAdmin
      .from('sites')
      .select(`
        id,
        site_url,
        site_name,
        status,
        last_paired_at,
        license:licenses (
          id,
          license_key,
          status,
          expires_at,
          plan_limits
        )
      `)
      .eq('tenant_id', userTenants.tenant_id);

    if (sitesError) {
      throw sitesError;
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Check each site for notifications
    for (const site of sites || []) {
      const license = site.license as any;

      // License expiration checks
      if (license?.expires_at) {
        const expiresAt = new Date(license.expires_at);
        
        if (expiresAt < now) {
          // License expired
          notifications.push({
            id: `license_expired_${site.id}`,
            type: 'license_expired',
            severity: 'error',
            title: 'License Expired',
            message: `License for ${site.site_name || site.site_url} has expired. Please renew to continue service.`,
            action_url: `/dashboard/sites`,
            action_label: 'View Sites',
            created_at: expiresAt.toISOString(),
          });
        } else if (expiresAt < thirtyDaysFromNow) {
          // License expiring soon
          const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
          notifications.push({
            id: `license_expiring_${site.id}`,
            type: 'license_expiring',
            severity: 'warning',
            title: 'License Expiring Soon',
            message: `License for ${site.site_name || site.site_url} expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}.`,
            action_url: `/dashboard/sites`,
            action_label: 'View Sites',
            created_at: now.toISOString(),
          });
        }
      }

      // License status checks
      if (license?.status === 'expired' || license?.status === 'revoked') {
        notifications.push({
          id: `license_status_${site.id}`,
          type: license.status === 'expired' ? 'license_expired' : 'license_expiring',
          severity: 'error',
          title: `License ${license.status === 'expired' ? 'Expired' : 'Revoked'}`,
          message: `License for ${site.site_name || site.site_url} is ${license.status}.`,
          action_url: `/dashboard/sites`,
          action_label: 'View Sites',
          created_at: now.toISOString(),
        });
      }

      // Site status checks
      if (site.status === 'disabled') {
        notifications.push({
          id: `site_disabled_${site.id}`,
          type: 'site_disabled',
          severity: 'warning',
          title: 'Site Disabled',
          message: `${site.site_name || site.site_url} is currently disabled.`,
          action_url: `/dashboard/sites`,
          action_label: 'View Sites',
          created_at: now.toISOString(),
        });
      }

      // Site inactivity check (no activity in last 7 days)
      if (site.status === 'active' && site.last_paired_at) {
        const lastPaired = new Date(site.last_paired_at);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        if (lastPaired < sevenDaysAgo) {
          notifications.push({
            id: `site_inactive_${site.id}`,
            type: 'site_inactive',
            severity: 'info',
            title: 'Site Inactive',
            message: `${site.site_name || site.site_url} has had no activity in the last 7 days.`,
            action_url: `/dashboard/sites`,
            action_label: 'View Sites',
            created_at: now.toISOString(),
          });
        }
      }

      // Usage limit checks (if we have plan limits)
      if (license?.plan_limits) {
        const planLimits = license.plan_limits;
        
        // Get today's usage
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // Check token usage
        if (planLimits.max_tokens_per_day) {
          const { data: usageToday, error: usageError } = await supabaseAdmin
            .from('usage_daily')
            .select('total_tokens')
            .eq('site_id', site.id)
            .eq('date', today.toISOString().split('T')[0])
            .single();

          if (!usageError && usageToday) {
            const tokensUsed = usageToday.total_tokens || 0;
            const tokensLimit = planLimits.max_tokens_per_day;
            const usagePercent = (tokensUsed / tokensLimit) * 100;

            if (usagePercent >= 100) {
              notifications.push({
                id: `usage_limit_tokens_${site.id}`,
                type: 'usage_limit',
                severity: 'error',
                title: 'Token Limit Reached',
                message: `${site.site_name || site.site_url} has reached its daily token limit (${tokensLimit.toLocaleString()}).`,
                action_url: `/dashboard/analytics?site_id=${site.id}`,
                action_label: 'View Analytics',
                created_at: now.toISOString(),
              });
            } else if (usagePercent >= 80) {
              notifications.push({
                id: `usage_warning_tokens_${site.id}`,
                type: 'usage_limit',
                severity: 'warning',
                title: 'Token Limit Warning',
                message: `${site.site_name || site.site_url} has used ${usagePercent.toFixed(0)}% of its daily token limit.`,
                action_url: `/dashboard/analytics?site_id=${site.id}`,
                action_label: 'View Analytics',
                created_at: now.toISOString(),
              });
            }
          }
        }

        // Check request usage
        if (planLimits.max_chat_requests_per_day) {
          const { data: usageToday, error: usageError } = await supabaseAdmin
            .from('usage_daily')
            .select('chat_requests')
            .eq('site_id', site.id)
            .eq('date', today.toISOString().split('T')[0])
            .single();

          if (!usageError && usageToday) {
            const requestsUsed = usageToday.chat_requests || 0;
            const requestsLimit = planLimits.max_chat_requests_per_day;
            const usagePercent = (requestsUsed / requestsLimit) * 100;

            if (usagePercent >= 100) {
              notifications.push({
                id: `usage_limit_requests_${site.id}`,
                type: 'usage_limit',
                severity: 'error',
                title: 'Request Limit Reached',
                message: `${site.site_name || site.site_url} has reached its daily request limit (${requestsLimit.toLocaleString()}).`,
                action_url: `/dashboard/analytics?site_id=${site.id}`,
                action_label: 'View Analytics',
                created_at: now.toISOString(),
              });
            } else if (usagePercent >= 80) {
              notifications.push({
                id: `usage_warning_requests_${site.id}`,
                type: 'usage_limit',
                severity: 'warning',
                title: 'Request Limit Warning',
                message: `${site.site_name || site.site_url} has used ${usagePercent.toFixed(0)}% of its daily request limit.`,
                action_url: `/dashboard/analytics?site_id=${site.id}`,
                action_label: 'View Analytics',
                created_at: now.toISOString(),
              });
            }
          }
        }
      }
    }

    // Sort notifications by severity (error > warning > info) and then by date
    notifications.sort((a, b) => {
      const severityOrder = { error: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return NextResponse.json({
      notifications,
      unread_count: notifications.length,
    });
  } catch (error) {
    console.error('Notifications GET error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch notifications',
        },
      },
      { status: 500 }
    );
  }
}
