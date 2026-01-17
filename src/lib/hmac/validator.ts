/**
 * HMAC signature validation for incoming requests from WordPress
 * 
 * Validates HMAC-SHA256 signatures according to API contract v1.0
 * - Canonical string: {METHOD}\n{PATH}\n{TS}\n{NONCE}\n{BODY_HASH}
 * - Timestamp tolerance: ±5 minutes
 * - Nonce replay prevention: 10 minutes window
 */

import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/server';

const supabaseAdmin = createAdminClient();

// Nonce cache (in-memory, cleared after 10 minutes)
// In production, consider using Redis or similar for distributed systems
const nonceCache = new Map<string, number>();
const NONCE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

// Clean up old nonces periodically
setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of nonceCache.entries()) {
    if (now - timestamp > NONCE_TTL_MS) {
      nonceCache.delete(nonce);
    }
  }
}, 60000); // Clean every minute

export interface HMACValidationResult {
  valid: boolean;
  error?: {
    code: string;
    message: string;
  };
  site_id?: string;
  site_secret?: string;
}

/**
 * Validate HMAC signature from WordPress request
 */
export async function validateHMAC(
  method: string,
  path: string,
  headers: Headers,
  body: string
): Promise<HMACValidationResult> {
  // Extract required headers
  const siteId = headers.get('X-AI-Site');
  const timestamp = headers.get('X-AI-Ts');
  const nonce = headers.get('X-AI-Nonce');
  const signature = headers.get('X-AI-Sign');

  // Validate headers are present
  if (!siteId || !timestamp || !nonce || !signature) {
    return {
      valid: false,
      error: {
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Missing required HMAC headers (X-AI-Site, X-AI-Ts, X-AI-Nonce, X-AI-Sign)',
      },
    };
  }

  // Validate timestamp format and tolerance
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return {
      valid: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Invalid timestamp format',
      },
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const timestampDiff = Math.abs(now - timestampNum);
  if (timestampDiff > TIMESTAMP_TOLERANCE_MS / 1000) {
    return {
      valid: false,
      error: {
        code: 'INVALID_TIMESTAMP',
        message: `Timestamp outside ±5 minute window (diff: ${timestampDiff}s)`,
      },
    };
  }

  // Check nonce replay
  if (nonceCache.has(nonce)) {
    return {
      valid: false,
      error: {
        code: 'NONCE_REUSED',
        message: 'Nonce has been used before (replay attack)',
      },
    };
  }

  // Get site and secret from database
  const { data: site, error: siteError } = await supabaseAdmin
    .from('sites')
    .select('id, secret, status')
    .eq('id', siteId)
    .single();

  if (siteError || !site) {
    return {
      valid: false,
      error: {
        code: 'SITE_NOT_FOUND',
        message: 'Site not found or inactive',
      },
    };
  }

  if (site.status !== 'active') {
    return {
      valid: false,
      error: {
        code: 'SITE_DISABLED',
        message: 'Site is disabled',
      },
    };
  }

  // Compute body hash
  const bodyHash = body ? createHash('sha256').update(body).digest('hex') : '';

  // Build canonical string
  const canonicalString = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${bodyHash}`;

  // Compute expected signature
  const expectedSignature = createHmac('sha256', site.secret)
    .update(canonicalString)
    .digest('base64');

  // Compare signatures (timing-safe)
  const providedSignatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
  ) {
    return {
      valid: false,
      error: {
        code: 'INVALID_SIGNATURE',
        message: 'HMAC signature validation failed',
      },
    };
  }

  // Store nonce to prevent replay (with timestamp for cleanup)
  nonceCache.set(nonce, Date.now());

  return {
    valid: true,
    site_id: site.id,
    site_secret: site.secret,
  };
}
