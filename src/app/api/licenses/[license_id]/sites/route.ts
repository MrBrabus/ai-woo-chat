/**
 * GET /api/licenses/{license_id}/sites
 * List all sites for a license (dashboard-authenticated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { verifySiteAccess, getUserTenantId } from '@/lib/site-management';

const supabaseAdmin = createAdminClient();

export async function GET(
  req: NextRequest,
  { params }: { params: { license_id: string } }
) {
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

    const { license_id } = params;

    if (!license_id) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'license_id is required',
          },
        },
        { status: 400 }
      );
    }

    // Get license to verify access
    const { data: license, error: licenseError } = await supabaseAdmin
      .from('licenses')
      .select('tenant_id')
      .eq('id', license_id)
      .single();

    if (licenseError || !license) {
      return NextResponse.json(
        {
          error: {
            code: 'LICENSE_NOT_FOUND',
            message: 'License not found',
          },
        },
        { status: 404 }
      );
    }

    // Check if user has access to this tenant
    const user_tenant_id = await getUserTenantId(user.id);
    const { data: platform_user } = await supabaseAdmin
      .from('platform_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    if (user_tenant_id !== license.tenant_id && !platform_user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Access denied to this license',
          },
        },
        { status: 403 }
      );
    }

    // Get all sites for this license
    const { data: sites, error: sitesError } = await supabaseAdmin
      .from('sites')
      .select(
        'id, site_url, environment, status, created_at, last_paired_at, disabled_at'
      )
      .eq('license_id', license_id)
      .order('created_at', { ascending: false });

    if (sitesError) {
      throw new Error(`Failed to fetch sites: ${sitesError.message}`);
    }

    // Format response
    const formatted_sites = (sites || []).map((site) => ({
      id: site.id,
      url: site.site_url,
      environment: site.environment,
      status: site.status,
      paired_at: site.last_paired_at || site.created_at,
      disabled_at: site.disabled_at,
    }));

    return NextResponse.json({
      sites: formatted_sites,
      count: formatted_sites.length,
    });
  } catch (error) {
    console.error('List sites error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list sites',
        },
      },
      { status: 500 }
    );
  }
}
