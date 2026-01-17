/**
 * POST /api/licenses/{license_id}/revoke
 * Revoke a license (kill-switch) - dashboard-authenticated
 * 
 * This endpoint allows super_admin or tenant owners to revoke a license,
 * which will immediately disable all sites and block all runtime requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { revokeLicense, getLicenseById } from '@/lib/license/license-utils';
import { getCurrentUser } from '@/lib/auth/helpers';
import { logAuditEvent } from '@/lib/site-management';

const supabaseAdmin = createAdminClient();

export async function POST(
  req: NextRequest,
  { params }: { params: { license_id: string } }
) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    const license_id = params.license_id;

    // Get license to verify access
    const { license, error: licenseError } = await getLicenseById(license_id);
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

    // Check if user has permission to revoke
    // Super admin can revoke any license
    const { data: platformUser } = await supabaseAdmin
      .from('platform_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    // Tenant owner/admin can revoke licenses for their tenant
    const { data: userTenant } = await supabaseAdmin
      .from('user_tenants')
      .select('*')
      .eq('user_id', user.id)
      .eq('tenant_id', license.tenant_id)
      .in('role', ['owner', 'admin'])
      .single();

    if (!platformUser && !userTenant) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have permission to revoke this license',
          },
        },
        { status: 403 }
      );
    }

    // Get reason from request body
    const body = await req.json().catch(() => ({}));
    const reason = body.reason || 'Manual revocation';

    // Revoke license
    const result = await revokeLicense(license_id, reason);
    if (!result.success) {
      return NextResponse.json(
        {
          error: {
            code: 'REVOCATION_FAILED',
            message: result.error || 'Failed to revoke license',
          },
        },
        { status: 500 }
      );
    }

    // Log audit event
    await logAuditEvent(license.tenant_id, 'license.revoke', {
      license_id,
      user_id: user.id,
      resource_type: 'license',
      resource_id: license_id,
      old_values: {
        status: license.status,
      },
      new_values: {
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      },
      metadata: {
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      license_id,
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      message: 'License has been revoked. All associated sites have been disabled.',
    });
  } catch (error: any) {
    console.error('License revocation error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to revoke license',
        },
      },
      { status: 500 }
    );
  }
}
