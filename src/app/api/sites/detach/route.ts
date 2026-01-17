/**
 * POST /api/sites/detach
 * Detach/unpair a site from a license (dashboard-authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  verifySiteAccess,
  rotateSiteSecret,
  checkDetachLimits,
  logAuditEvent,
  getUserTenantId,
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
    const { site_id } = body;

    if (!site_id) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'site_id is required',
            details: { field: 'site_id' },
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

    // Check detach limits (cooldown + monthly limit)
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
            message: limitCheck.reason || 'Detach not allowed',
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

    // Store old values for audit log
    const old_site_url = site.site_url;
    const old_allowed_origins = site.allowed_origins || [];

    // Rotate site secret (invalidates old secret)
    await rotateSiteSecret(site_id);

    // Disable the site
    const { error: updateError } = await supabaseAdmin
      .from('sites')
      .update({
        status: 'disabled',
        disabled_at: new Date().toISOString(),
        allowed_origins: [], // Clear allowed origins
      })
      .eq('id', site_id);

    if (updateError) {
      throw new Error(`Failed to disable site: ${updateError.message}`);
    }

    // Log audit event
    await logAuditEvent(tenant_id, 'site.detach', {
      license_id,
      site_id,
      user_id: user.id,
      resource_type: 'site',
      resource_id: site_id,
      old_values: {
        site_url: old_site_url,
        allowed_origins: old_allowed_origins,
        status: site.status,
      },
      new_values: {
        status: 'disabled',
        allowed_origins: [],
      },
      metadata: {
        reason: 'user_detach',
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || undefined,
      user_agent: req.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({
      ok: true,
      site_id,
      status: 'disabled',
    });
  } catch (error) {
    console.error('Detach site error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to detach site',
        },
      },
      { status: 500 }
    );
  }
}
