/**
 * Runtime validation middleware for public endpoints
 * Checks site status, license status, and allowed_origins (CORS)
 * Use this for /api/chat/bootstrap, /api/chat/message, /api/chat/events
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizeOrigin } from '@/lib/site-management';
import { checkLicenseKillSwitch } from './license-kill-switch';

const supabaseAdmin = createAdminClient();

export interface RuntimeValidationResult {
  allowed: boolean;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  site?: any;
  license?: any;
}

/**
 * Validate runtime request (site status, license status, CORS)
 */
export async function validateRuntimeRequest(
  req: NextRequest,
  site_id: string
): Promise<RuntimeValidationResult> {
  // Get Origin header
  const origin = req.headers.get('origin');
  if (!origin) {
    return {
      allowed: false,
      error: {
        code: 'MISSING_ORIGIN',
        message: 'Origin header is required',
      },
    };
  }

  // Get site with license info
  const { data: site, error: siteError } = await supabaseAdmin
    .from('sites')
    .select('*, license:licenses(*)')
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

  const license = site.license as any;

  // Check site status
  if (site.status !== 'active') {
    return {
      allowed: false,
      error: {
        code:
          site.status === 'disabled'
            ? 'SITE_DISABLED'
            : site.status === 'revoked'
            ? 'SITE_REVOKED'
            : 'SITE_INACTIVE',
        message:
          site.status === 'disabled'
            ? 'This site has been detached. Chat is unavailable.'
            : site.status === 'revoked'
            ? 'This site has been revoked. Chat is unavailable.'
            : 'Site is not active. Chat is unavailable.',
      },
    };
  }

  // Check license kill-switch (immediate revocation check)
  const killSwitchCheck = await checkLicenseKillSwitch(site_id);
  if (!killSwitchCheck.allowed) {
    return {
      allowed: false,
      error: killSwitchCheck.error!,
    };
  }

  // Additional license status check (redundant but explicit)
  if (!license || license.status !== 'active') {
    return {
      allowed: false,
      error: {
        code:
          license?.status === 'revoked'
            ? 'LICENSE_REVOKED'
            : license?.status === 'expired'
            ? 'LICENSE_EXPIRED'
            : 'LICENSE_NOT_FOUND',
        message: `License is ${license?.status || 'not found'}. Chat is unavailable.`,
      },
    };
  }

  // Check allowed_origins (CORS)
  const allowed_origins = site.allowed_origins || [];
  if (allowed_origins.length === 0) {
    // If no allowed_origins set, this is likely a misconfiguration
    return {
      allowed: false,
      error: {
        code: 'INVALID_ORIGIN',
        message: 'Site configuration error. Please contact support.',
      },
    };
  }

  // Normalize origin for comparison
  let normalized_origin: string;
  try {
    normalized_origin = normalizeOrigin(origin);
  } catch (error) {
    return {
      allowed: false,
      error: {
        code: 'INVALID_ORIGIN',
        message: 'Invalid origin format',
      },
    };
  }

  // Check if origin is in allowed_origins
  const origin_allowed = allowed_origins.some((allowed: string) => {
    try {
      const normalized_allowed = normalizeOrigin(allowed);
      return normalized_allowed === normalized_origin;
    } catch {
      // If allowed_origin is not a valid URL, do exact match
      return allowed === origin;
    }
  });

  if (!origin_allowed) {
    return {
      allowed: false,
      error: {
        code: 'INVALID_ORIGIN',
        message: 'Origin not allowed. Contact support to add your domain.',
        details: {
          origin,
          allowed_origins,
        },
      },
    };
  }

  return {
    allowed: true,
    site,
    license,
  };
}

/**
 * Middleware wrapper for runtime endpoints
 */
export function withRuntimeValidation(
  handler: (req: NextRequest, site_id: string, site: any, license: any) => Promise<Response>
) {
  return async (req: NextRequest): Promise<Response> => {
    // Handle OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      const origin = req.headers.get('origin');
      if (!origin) {
        return new NextResponse(null, { status: 403 });
      }

      // Extract site_id from body or query for validation
      let site_id: string | null = null;
      try {
        const body = await req.json().catch(() => ({}));
        site_id = body.site_id || null;
      } catch {
        const url = new URL(req.url);
        site_id = url.searchParams.get('site_id');
      }

      if (!site_id) {
        return new NextResponse(null, { status: 400 });
      }

      // Validate origin
      const validation = await validateRuntimeRequest(req, site_id);
      if (!validation.allowed) {
        return new NextResponse(null, { status: 403 });
      }

      // Return preflight response with CORS headers
      const headers = new Headers();
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      headers.set('Vary', 'Origin');
      headers.set('Access-Control-Max-Age', '86400'); // 24 hours

      return new NextResponse(null, { status: 204, headers });
    }

    try {
      // Extract site_id from request body or query
      let site_id: string | null = null;
      let requestBody: any = null;

      if (req.method === 'POST') {
        // Read body once and extract site_id
        try {
          requestBody = await req.json();
          site_id = requestBody.site_id;
        } catch {
          // Body might not be JSON or already consumed
          // Try to get from URL if available
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

      // Validate runtime request
      const validation = await validateRuntimeRequest(req, site_id);
      if (!validation.allowed) {
        // Don't include CORS headers if origin is invalid
        const statusCode =
          validation.error?.code === 'INVALID_ORIGIN' ||
          validation.error?.code === 'MISSING_ORIGIN'
            ? 403
            : validation.error?.code === 'SITE_NOT_FOUND'
            ? 404
            : 403;

        return NextResponse.json(
          {
            error: validation.error,
          },
          { status: statusCode }
        );
      }

      // Reconstruct request with body if we read it
      // Note: Next.js doesn't allow reading body twice, so we pass body separately
      // The handler should accept body as optional parameter or reconstruct request
      const origin = req.headers.get('origin');
      
      // Create a new request with the body if we have it
      let requestToHandler = req;
      if (requestBody && req.method === 'POST') {
        // Reconstruct request with body
        requestToHandler = new NextRequest(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(requestBody),
        });
      }

      const response = await handler(requestToHandler, site_id, validation.site!, validation.license!);

      // Add CORS headers for valid origin
      const headers = new Headers(response.headers);
      if (origin) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        headers.set('Vary', 'Origin');
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error('Runtime validation error:', error);
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
