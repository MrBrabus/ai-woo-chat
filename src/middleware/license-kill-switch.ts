/**
 * License kill-switch middleware
 * Blocks all requests for revoked/expired licenses
 * 
 * This middleware should be used in all runtime endpoints (chat, ingestion)
 * to immediately stop service when a license is revoked.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkLicenseStatus } from '@/lib/license/license-utils';

const supabaseAdmin = createAdminClient();

export interface LicenseCheckResult {
  allowed: boolean;
  error?: {
    code: string;
    message: string;
  };
  license_id?: string;
}

/**
 * Check license status for a site
 * Returns immediately if license is revoked/expired (kill-switch)
 */
export async function checkLicenseKillSwitch(
  site_id: string
): Promise<LicenseCheckResult> {
  // Get site with license
  const { data: site, error: siteError } = await supabaseAdmin
    .from('sites')
    .select('license_id, status')
    .eq('id', site_id)
    .single();

  if (siteError || !site) {
    return {
      allowed: false,
      error: {
        code: 'SITE_NOT_FOUND',
        message: 'Site not found',
      },
    };
  }

  // Check site status first
  if (site.status !== 'active') {
    return {
      allowed: false,
      error: {
        code: 'SITE_DISABLED',
        message: 'Site is disabled',
      },
    };
  }

  // Check license status (kill-switch)
  const licenseCheck = await checkLicenseStatus(site.license_id);
  
  if (!licenseCheck.valid) {
    return {
      allowed: false,
      license_id: site.license_id,
      error: {
        code:
          licenseCheck.status === 'revoked'
            ? 'LICENSE_REVOKED'
            : licenseCheck.status === 'expired'
            ? 'LICENSE_EXPIRED'
            : 'LICENSE_INVALID',
        message:
          licenseCheck.status === 'revoked'
            ? 'License has been revoked. Service is unavailable.'
            : licenseCheck.status === 'expired'
            ? 'License has expired. Service is unavailable.'
            : 'License is not valid. Service is unavailable.',
      },
    };
  }

  return {
    allowed: true,
    license_id: site.license_id,
  };
}

/**
 * Middleware wrapper that enforces license kill-switch
 */
export function withLicenseKillSwitch(
  handler: (req: NextRequest, site_id: string) => Promise<Response>
) {
  return async (req: NextRequest): Promise<Response> => {
    try {
      // Extract site_id from request
      let site_id: string | null = null;

      if (req.method === 'POST') {
        try {
          const body = await req.json();
          site_id = body.site_id;
        } catch {
          const url = new URL(req.url);
          site_id = url.searchParams.get('site_id');
        }
      } else if (req.method === 'GET') {
        const url = new URL(req.url);
        site_id = url.searchParams.get('site_id');
      }

      if (!site_id) {
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

      // Check license kill-switch
      const licenseCheck = await checkLicenseKillSwitch(site_id);
      if (!licenseCheck.allowed) {
        return NextResponse.json(
          {
            error: licenseCheck.error,
          },
          { status: 403 }
        );
      }

      // Reconstruct request if body was consumed
      let requestToHandler = req;
      if (req.method === 'POST') {
        try {
          const body = await req.json();
          requestToHandler = new NextRequest(req.url, {
            method: req.method,
            headers: req.headers,
            body: JSON.stringify(body),
          });
        } catch {
          // Body already consumed or not JSON
        }
      }

      return await handler(requestToHandler, site_id);
    } catch (error) {
      console.error('License kill-switch error:', error);
      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An error occurred while processing your request',
          },
        },
        { status: 500 }
      );
    }
  };
}
