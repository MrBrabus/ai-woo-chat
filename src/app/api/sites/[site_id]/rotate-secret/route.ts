/**
 * POST /api/sites/{site_id}/rotate-secret
 * Rotate site secret (dashboard-authenticated)
 * 
 * This endpoint allows dashboard users to rotate the site secret
 * for security purposes (e.g., if secret is compromised)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rotateSiteSecret, verifySiteAccess, logAuditEvent } from '@/lib/site-management';
import { getCurrentUser } from '@/lib/auth/helpers';

const supabaseAdmin = createAdminClient();

export async function POST(
  req: NextRequest,
  { params }: { params: { site_id: string } }
) {
  try {
    // Authenticate user
    const user = await getCurrentUser();
    const site_id = params.site_id;

    // Verify user has access to this site
    const accessCheck = await verifySiteAccess(user.id, site_id);
    if (!accessCheck.allowed || !accessCheck.site) {
      return NextResponse.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'You do not have access to this site',
          },
        },
        { status: 403 }
      );
    }

    const site = accessCheck.site;
    const tenant_id = accessCheck.tenant_id!;

    // Get optional new_origin from request body
    const body = await req.json().catch(() => ({}));
    const new_origin = body.new_origin;

    // Rotate secret
    const result = await rotateSiteSecret(site_id, new_origin);

    // Log audit event
    await logAuditEvent(tenant_id, 'site.secret_rotate', {
      license_id: site.license_id,
      site_id,
      user_id: user.id,
      resource_type: 'site',
      resource_id: site_id,
      old_values: {
        secret_rotated_at: site.secret_rotated_at,
      },
      new_values: {
        secret_rotated_at: new Date().toISOString(),
        allowed_origins: result.allowed_origins,
      },
      metadata: {
        reason: 'manual_rotation',
        new_origin: new_origin || null,
      },
    });

    return NextResponse.json({
      site_id,
      site_secret: result.site_secret,
      allowed_origins: result.allowed_origins,
      secret_rotated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Secret rotation error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Failed to rotate site secret',
        },
      },
      { status: 500 }
    );
  }
}
