/**
 * POST /api/sites/promote
 * Promote staging site to production or change site URL (dashboard-authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  verifySiteAccess,
  rotateSiteSecret,
  checkDetachLimits,
  checkLicenseSlots,
  normalizeOrigin,
  logAuditEvent,
} from '../../../lib/site-management';

const supabaseAdmin = createAdminClient();

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user from session
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
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

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid authentication token',
          },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { site_id, new_site_url, new_environment } = body;

    if (!site_id || !new_site_url) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'site_id and new_site_url are required',
            details: {
              fields: ['site_id', 'new_site_url'],
            },
          },
        },
        { status: 400 }
      );
    }

    // Validate new_site_url format
    let normalized_origin: string;
    try {
      normalized_origin = normalizeOrigin(new_site_url);
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SITE_URL',
            message: 'Invalid site URL format',
            details: {
              url: new_site_url,
            },
          },
        },
        { status: 400 }
      );
    }

    // Validate environment
    const environment = new_environment || 'production';
    if (!['production', 'staging'].includes(environment)) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_FORMAT',
            message: 'new_environment must be "production" or "staging"',
          },
        },
        { status: 400 }
      );
    }

    // Verify user has access to this site
    const access = await verifySiteAccess(user.id, site_id);
    if (!access.allowed || !access.site) {
      return NextResponse.json(
        {
          error: {
            code: 'SITE_NOT_FOUND',
            message: 'Site not found or access denied',
          },
        },
        { status: 404 }
      );
    }

    const site = access.site;
    const tenant_id = access.tenant_id!;
    const license_id = site.license_id;

    // Check detach limits (cooldown + monthly limit) - same limits apply to promote
    const limitCheck = await checkDetachLimits(license_id);
    if (!limitCheck.allowed) {
      const statusCode =
        limitCheck.reason?.includes('limit reached') ||
        limitCheck.reason?.includes('Cooldown')
          ? 429
          : 403;

      return NextResponse.json(
        {
          error: {
            code:
              limitCheck.reason?.includes('limit reached')
                ? 'LICENSE_DETACH_MONTHLY_LIMIT_REACHED'
                : 'LICENSE_DETACH_COOLDOWN_ACTIVE',
            message: limitCheck.reason || 'Promote not allowed',
            details: {
              cooldown_hours_remaining: limitCheck.cooldown_hours_remaining,
              detaches_this_month: limitCheck.detaches_this_month,
              max_detach_per_month: limitCheck.max_detach_per_month,
            },
          },
        },
        { status: statusCode }
      );
    }

    // Check if new URL is already active for this license (unless promoting the same site)
    if (normalized_origin !== normalizeOrigin(site.site_url)) {
      const { data: existing_site } = await supabaseAdmin
        .from('sites')
        .select('id, site_url')
        .eq('license_id', license_id)
        .eq('status', 'active')
        .neq('id', site_id)
        .single();

      if (existing_site) {
        const existing_origin = normalizeOrigin(existing_site.site_url);
        if (existing_origin === normalized_origin) {
          return NextResponse.json(
            {
              error: {
                code: 'LICENSE_SITE_LIMIT_REACHED',
                message: 'A site with this URL is already active for this license',
                details: {
                  existing_site_id: existing_site.id,
                },
              },
            },
            { status: 409 }
          );
        }
      }

      // Check license slots if promoting to production
      if (environment === 'production') {
        const slotCheck = await checkLicenseSlots(license_id);
        if (!slotCheck.available) {
          return NextResponse.json(
            {
              error: {
                code: 'LICENSE_SITE_LIMIT_REACHED',
                message: 'License has reached maximum number of active sites',
                details: {
                  current_count: slotCheck.current_count,
                  max_sites: slotCheck.max_sites,
                },
              },
            },
            { status: 409 }
          );
        }
      }
    }

    // Store old values for audit log
    const old_site_url = site.site_url;
    const old_environment = site.environment;
    const old_allowed_origins = site.allowed_origins || [];

    // Rotate site secret and update allowed_origins
    const { site_secret, allowed_origins } = await rotateSiteSecret(
      site_id,
      new_site_url
    );

    // Update site
    const { error: updateError } = await supabaseAdmin
      .from('sites')
      .update({
        site_url: new_site_url,
        environment,
        allowed_origins,
        status: 'active', // Ensure it's active
        last_paired_at: new Date().toISOString(),
      })
      .eq('id', site_id);

    if (updateError) {
      throw new Error(`Failed to update site: ${updateError.message}`);
    }

    // Log audit event
    await logAuditEvent(tenant_id, 'site.promote', {
      license_id,
      site_id,
      user_id: user.id,
      resource_type: 'site',
      resource_id: site_id,
      old_values: {
        site_url: old_site_url,
        environment: old_environment,
        allowed_origins: old_allowed_origins,
      },
      new_values: {
        site_url: new_site_url,
        environment,
        allowed_origins,
      },
      metadata: {
        reason: 'user_promote',
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      ok: true,
      site_id,
      site_url: new_site_url,
      environment,
      site_secret, // Return new secret for WP plugin
    });
  } catch (error) {
    console.error('Promote site error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to promote site',
        },
      },
      { status: 500 }
    );
  }
}
