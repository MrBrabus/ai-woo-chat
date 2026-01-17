/**
 * Site management utilities for domain transfer operations
 * Handles origin normalization, secret rotation, and cooldown/limit checks
 */

import { createAdminClient } from './supabase/server';
import crypto from 'crypto';

const supabaseAdmin = createAdminClient();

/**
 * Normalize a URL to its origin (scheme + host + optional port)
 * Examples:
 * - https://example.com -> https://example.com
 * - https://example.com:443 -> https://example.com
 * - http://localhost:3000 -> http://localhost:3000
 */
export function normalizeOrigin(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove default ports
    let origin = `${urlObj.protocol}//${urlObj.hostname}`;
    if (urlObj.port && urlObj.port !== '80' && urlObj.port !== '443') {
      origin += `:${urlObj.port}`;
    }
    return origin;
  } catch (error) {
    throw new Error(`Invalid URL format: ${url}`);
  }
}

/**
 * Generate a new site secret
 */
export function generateSiteSecret(): string {
  return `sec_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Rotate site secret and update allowed_origins
 */
export async function rotateSiteSecret(
  site_id: string,
  new_origin?: string
): Promise<{ site_secret: string; allowed_origins: string[] }> {
  const new_secret = generateSiteSecret();
  const updateData: any = {
    site_secret: new_secret,
    secret_rotated_at: new Date().toISOString(),
  };

  if (new_origin) {
    const normalized_origin = normalizeOrigin(new_origin);
    updateData.allowed_origins = [normalized_origin];
  }

  const { error } = await supabaseAdmin
    .from('sites')
    .update(updateData)
    .eq('id', site_id);

  if (error) {
    throw new Error(`Failed to rotate site secret: ${error.message}`);
  }

  return {
    site_secret: new_secret,
    allowed_origins: updateData.allowed_origins || [],
  };
}

/**
 * Check if license has available slots for new sites
 */
export async function checkLicenseSlots(
  license_id: string
): Promise<{ available: boolean; current_count: number; max_sites: number }> {
  const { data: license } = await supabaseAdmin
    .from('licenses')
    .select('max_sites')
    .eq('id', license_id)
    .single();

  if (!license) {
    throw new Error('License not found');
  }

  const max_sites = license.max_sites ?? 2;

  // Count active sites for this license
  const { count } = await supabaseAdmin
    .from('sites')
    .select('*', { count: 'exact', head: true })
    .eq('license_id', license_id)
    .eq('status', 'active');

  const current_count = count ?? 0;

  return {
    available: current_count < max_sites,
    current_count,
    max_sites,
  };
}

/**
 * Check detach cooldown and monthly limit
 */
export async function checkDetachLimits(
  license_id: string
): Promise<{
  allowed: boolean;
  reason?: string;
  cooldown_hours_remaining?: number;
  detaches_this_month?: number;
  max_detach_per_month?: number;
}> {
  // Get license plan limits
  const { data: license } = await supabaseAdmin
    .from('licenses')
    .select('plan_limits')
    .eq('id', license_id)
    .single();

  if (!license) {
    return { allowed: false, reason: 'License not found' };
  }

  const plan_limits = license.plan_limits as {
    detach_cooldown_hours?: number;
    max_detach_per_month?: number;
  };

  const cooldown_hours = plan_limits?.detach_cooldown_hours ?? 24;
  const max_detach_per_month = plan_limits?.max_detach_per_month ?? 3;

  // Check monthly limit - count detach actions in current month
  const now = new Date();
  const start_of_month = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: detach_events } = await supabaseAdmin
    .from('audit_logs')
    .select('created_at')
    .eq('license_id', license_id)
    .eq('action', 'site.detach')
    .gte('created_at', start_of_month.toISOString());

  const detaches_this_month = detach_events?.length ?? 0;

  if (detaches_this_month >= max_detach_per_month) {
    return {
      allowed: false,
      reason: 'Monthly detach limit reached',
      detaches_this_month,
      max_detach_per_month,
    };
  }

  // Check cooldown - find most recent detach or promote action
  const { data: recent_action } = await supabaseAdmin
    .from('audit_logs')
    .select('created_at')
    .eq('license_id', license_id)
    .in('action', ['site.detach', 'site.promote'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (recent_action) {
    const last_action_time = new Date(recent_action.created_at);
    const hours_since = (now.getTime() - last_action_time.getTime()) / (1000 * 60 * 60);

    if (hours_since < cooldown_hours) {
      const hours_remaining = cooldown_hours - hours_since;
      return {
        allowed: false,
        reason: 'Cooldown period active',
        cooldown_hours_remaining: Math.ceil(hours_remaining),
      };
    }
  }

  return {
    allowed: true,
    detaches_this_month,
    max_detach_per_month,
  };
}

/**
 * Log audit event
 */
export async function logAuditEvent(
  tenant_id: string,
  action: string,
  options: {
    license_id?: string;
    site_id?: string;
    user_id?: string;
    resource_type?: string;
    resource_id?: string;
    old_values?: any;
    new_values?: any;
    metadata?: any;
    ip_address?: string;
    user_agent?: string;
  }
): Promise<void> {
  const { data, error } = await supabaseAdmin.rpc('log_audit_event', {
    p_tenant_id: tenant_id,
    p_license_id: options.license_id || null,
    p_site_id: options.site_id || null,
    p_user_id: options.user_id || null,
    p_action: action,
    p_resource_type: options.resource_type || null,
    p_resource_id: options.resource_id || null,
    p_old_values: options.old_values ? JSON.stringify(options.old_values) : null,
    p_new_values: options.new_values ? JSON.stringify(options.new_values) : null,
    p_metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    p_ip_address: options.ip_address || null,
    p_user_agent: options.user_agent || null,
  });

  if (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging should not break the main flow
  }
}

/**
 * Get user's tenant ID from authenticated session
 */
export async function getUserTenantId(user_id: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('user_tenants')
    .select('tenant_id')
    .eq('user_id', user_id)
    .limit(1)
    .single();

  return data?.tenant_id || null;
}

/**
 * Verify user has access to site (tenant-scoped)
 */
export async function verifySiteAccess(
  user_id: string,
  site_id: string
): Promise<{ allowed: boolean; site?: any; tenant_id?: string }> {
  // Get site with license and tenant info
  const { data: site, error } = await supabaseAdmin
    .from('sites')
    .select('*, license:licenses(*, tenant_id)')
    .eq('id', site_id)
    .single();

  if (error || !site) {
    return { allowed: false };
  }

  const tenant_id = (site.license as any)?.tenant_id;

  if (!tenant_id) {
    return { allowed: false };
  }

  // Check if user has access to this tenant
  const { data: user_tenant } = await supabaseAdmin
    .from('user_tenants')
    .select('*')
    .eq('user_id', user_id)
    .eq('tenant_id', tenant_id)
    .single();

  // Also check if user is super_admin
  const { data: platform_user } = await supabaseAdmin
    .from('platform_users')
    .select('*')
    .eq('user_id', user_id)
    .eq('role', 'super_admin')
    .single();

  const allowed = !!user_tenant || !!platform_user;

  return {
    allowed,
    site,
    tenant_id,
  };
}
