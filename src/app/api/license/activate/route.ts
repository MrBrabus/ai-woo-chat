/**
 * POST /api/license/activate
 * License activation endpoint
 * Updated to handle disabled sites (can reuse or create new)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { checkLicenseSlots, normalizeOrigin, logAuditEvent } from '@/lib/site-management';
import { findLicenseByKey } from '@/lib/license/license-utils';
import { WPAPIClient, type SiteContext } from '@/lib/wordpress/client';
import crypto from 'crypto';

const supabaseAdmin = createAdminClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { license_key, site_url, site_name } = body;

    if (!license_key || !site_url) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'license_key and site_url are required',
          },
        },
        { status: 400 }
      );
    }

    // Validate site_url format
    let normalized_origin: string;
    try {
      normalized_origin = normalizeOrigin(site_url);
    } catch (error) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_SITE_URL',
            message: 'Invalid site URL format',
          },
        },
        { status: 400 }
      );
    }

    // Find license by key
    const { license, error: licenseError } = await findLicenseByKey(license_key);

    if (licenseError || !license) {
      return NextResponse.json(
        {
          error: {
            code: 'LICENSE_NOT_FOUND',
            message: 'License key not found',
          },
        },
        { status: 404 }
      );
    }

    // Check license status
    if (license.status !== 'active') {
      return NextResponse.json(
        {
          error: {
            code:
              license.status === 'revoked'
                ? 'LICENSE_REVOKED'
                : 'LICENSE_EXPIRED',
            message: `License is ${license.status}`,
          },
        },
        { status: 403 }
      );
    }

    // Check if site with this URL already exists for this license
    const { data: existing_site } = await supabaseAdmin
      .from('sites')
      .select('*')
      .eq('license_id', license.id)
      .eq('site_url', site_url)
      .single();

    if (existing_site) {
      // Site exists - check if it's disabled
      if (existing_site.status === 'disabled') {
        // Reuse disabled site - reactivate it
        const new_secret = `sec_${crypto.randomBytes(32).toString('hex')}`;
        
        // Discover REST API base URL if not already stored
        let rest_base_url = existing_site.rest_base_url;
        if (!rest_base_url) {
          try {
            rest_base_url = await WPAPIClient.discoverRestBaseUrl(site_url);
          } catch (error) {
            console.warn('Failed to discover REST API base URL during reactivation:', error);
            // Continue without rest_base_url - it can be discovered later during sync
          }
        }
        
        // Try to fetch fresh site context
        let site_context: SiteContext | null = null;
        try {
          const wpClient = new WPAPIClient({
            siteUrl,
            siteId: existing_site.id,
            secret: new_secret,
            restBaseUrl: rest_base_url,
          });
          site_context = await wpClient.getSiteContext();
        } catch (error) {
          console.warn('Failed to fetch site context during reactivation:', error);
        }
        
        const { error: updateError } = await supabaseAdmin
          .from('sites')
          .update({
            status: 'active',
            site_name: site_name || existing_site.site_name,
            allowed_origins: [normalized_origin],
            site_secret: new_secret,
            secret_rotated_at: new Date().toISOString(),
            last_paired_at: new Date().toISOString(),
            disabled_at: null,
            site_context: site_context ? (site_context as any) : existing_site.site_context,
            rest_base_url: rest_base_url || existing_site.rest_base_url,
          })
          .eq('id', existing_site.id);

        if (updateError) {
          throw new Error(`Failed to reactivate site: ${updateError.message}`);
        }

        // Log audit event
        await logAuditEvent((license.tenant as any).id, 'site.reactivate', {
          license_id: license.id,
          site_id: existing_site.id,
          resource_type: 'site',
          resource_id: existing_site.id,
          old_values: {
            status: 'disabled',
            disabled_at: existing_site.disabled_at,
          },
          new_values: {
            status: 'active',
            site_url,
            allowed_origins: [normalized_origin],
          },
          metadata: {
            reason: 'license_activate',
          },
        });

        return NextResponse.json({
          site_id: existing_site.id,
          site_secret: new_secret,
          status: 'active',
          expires_at: license.expires_at,
        });
      } else {
        // Site is already active - return existing credentials for reconnection
        return NextResponse.json({
          site_id: existing_site.id,
          site_secret: existing_site.site_secret,
          status: existing_site.status,
          expires_at: license.expires_at,
          message: 'Site is already active. Connection restored.',
        });
      }
    }

    // Check license slots
    const slotCheck = await checkLicenseSlots(license.id);
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

    // Create new site
    const site_id = crypto.randomUUID();
    const site_secret = `sec_${crypto.randomBytes(32).toString('hex')}`;

    // Discover REST API base URL (non-blocking - if it fails, continue without it)
    let rest_base_url: string | null = null;
    try {
      rest_base_url = await WPAPIClient.discoverRestBaseUrl(site_url);
    } catch (error) {
      // REST API discovery failed - this is OK, we'll try again later during sync
      console.warn('Failed to discover REST API base URL during activation:', error);
    }

    // Try to fetch site context from WordPress (non-blocking - if it fails, continue without it)
    let site_context: SiteContext | null = null;
    try {
      const wpClient = new WPAPIClient({
        siteUrl,
        siteId: site_id,
        secret: site_secret,
        restBaseUrl: rest_base_url || undefined,
      });
      site_context = await wpClient.getSiteContext();
    } catch (error) {
      // Site context fetch failed - this is OK, we'll try again later
      // WordPress plugin might not have REST API endpoints implemented yet
      console.warn('Failed to fetch site context during activation:', error);
    }

    const { error: insertError } = await supabaseAdmin.from('sites').insert({
      id: site_id,
      license_id: license.id,
      tenant_id: (license.tenant as any).id,
      site_url,
      site_name: site_name || 'My WooCommerce Store',
      site_secret,
      status: 'active',
      environment: 'production',
      allowed_origins: [normalized_origin],
      last_paired_at: new Date().toISOString(),
      site_context: site_context ? (site_context as any) : null,
      rest_base_url: rest_base_url,
    });

    if (insertError) {
      throw new Error(`Failed to create site: ${insertError.message}`);
    }

    // Log audit event
    await logAuditEvent((license.tenant as any).id, 'site.activate', {
      license_id: license.id,
      site_id,
      resource_type: 'site',
      resource_id: site_id,
      new_values: {
        site_url,
        site_name: site_name || 'My WooCommerce Store',
        status: 'active',
        environment: 'production',
        allowed_origins: [normalized_origin],
      },
      metadata: {
        reason: 'license_activate',
      },
    });

    return NextResponse.json({
      site_id,
      site_secret,
      status: 'active',
      expires_at: license.expires_at,
    });
  } catch (error) {
    console.error('License activation error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to activate license',
        },
      },
      { status: 500 }
    );
  }
}
