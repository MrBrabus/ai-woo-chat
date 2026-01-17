/**
 * License management utilities
 * Handles license status checks, revocation, and validation
 */

import { createAdminClient } from '../supabase/server';
import crypto from 'crypto';

const supabaseAdmin = createAdminClient();

/**
 * Hash a license key for storage
 */
export function hashLicenseKey(license_key: string): string {
  return crypto.createHash('sha256').update(license_key).digest('hex');
}

/**
 * Check if license is active and valid
 */
export async function checkLicenseStatus(license_id: string): Promise<{
  valid: boolean;
  status?: string;
  revoked_at?: string | null;
  expires_at?: string | null;
  error?: string;
}> {
  const { data: license, error } = await supabaseAdmin
    .from('licenses')
    .select('status, expires_at')
    .eq('id', license_id)
    .single();

  if (error || !license) {
    return {
      valid: false,
      error: 'License not found',
    };
  }

  // Check if revoked
  if (license.status === 'revoked') {
    return {
      valid: false,
      status: 'revoked',
    };
  }

  // Check if expired
  if (license.status === 'expired' || (license.expires_at && new Date(license.expires_at) < new Date())) {
    return {
      valid: false,
      status: 'expired',
      expires_at: license.expires_at,
    };
  }

  // Check if suspended
  if (license.status === 'suspended') {
    return {
      valid: false,
      status: 'suspended',
    };
  }

  return {
    valid: license.status === 'active',
    status: license.status,
    expires_at: license.expires_at,
  };
}

/**
 * Revoke a license (kill-switch)
 */
export async function revokeLicense(
  license_id: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabaseAdmin
    .from('licenses')
    .update({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', license_id);

  if (error) {
    return {
      success: false,
      error: error.message,
    };
  }

  // Also disable all sites for this license
  await supabaseAdmin
    .from('sites')
    .update({
      status: 'disabled',
      disabled_at: new Date().toISOString(),
    })
    .eq('license_id', license_id)
    .eq('status', 'active');

  return { success: true };
}

/**
 * Find license by key (plain text - for activation)
 * Note: Database stores plain license_key, not hash
 */
export async function findLicenseByKey(license_key: string): Promise<{
  license: any | null;
  error?: string;
}> {
  const { data: license, error } = await supabaseAdmin
    .from('licenses')
    .select('*, tenant:tenants(id)')
    .eq('license_key', license_key)
    .single();

  if (error || !license) {
    return {
      license: null,
      error: 'License not found',
    };
  }

  return { license };
}

/**
 * Get license by ID
 */
export async function getLicenseById(license_id: string): Promise<{
  license: any | null;
  error?: string;
}> {
  const { data: license, error } = await supabaseAdmin
    .from('licenses')
    .select('*, tenant:tenants(id)')
    .eq('id', license_id)
    .single();

  if (error || !license) {
    return {
      license: null,
      error: 'License not found',
    };
  }

  return { license };
}
