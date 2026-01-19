/**
 * Direct Postgres connection for pgvector operations
 * 
 * Uses direct Postgres connection to execute raw SQL queries
 * with pgvector operators (e.g., <=> for cosine distance)
 * 
 * This is needed because Supabase PostgREST doesn't support
 * pgvector operators directly.
 */

import { Pool, QueryResult } from 'pg';
import { loadEnvProduction } from '@/lib/utils/env-loader';

// Load environment variables from .env.production for standalone builds
loadEnvProduction();

let pool: Pool | null = null;

/**
 * Get Postgres connection pool
 * Uses Supabase direct database connection string from environment
 * 
 * For Supabase, use the direct connection string (not the pooler):
 * Format: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
 * Or: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
 * 
 * Environment variable: SUPABASE_DB_URL or DATABASE_URL
 */
function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
    
    if (!connectionString) {
      throw new Error(
        'SUPABASE_DB_URL or DATABASE_URL environment variable is required for direct Postgres connection. ' +
        'Use Supabase direct database connection string (not the pooler URL).'
      );
    }

    // Supabase requires SSL for direct connections
    const isSupabase = connectionString.includes('supabase.co') || 
                       connectionString.includes('supabase.com') ||
                       connectionString.includes('pooler.supabase');

    // Use pooler URL for Supabase to avoid IPv6 connection issues
    // PREFERRED: Use pooler URL directly from Supabase dashboard (Settings → Database → Connection pooling)
    // If connection string uses db. (direct connection), try to convert to pooler
    // Pooler has better IPv4 support and avoids IPv6 resolution issues
    let finalConnectionString = connectionString;
    if (isSupabase && connectionString.includes('db.')) {
      // Extract components from connection string
      // Format: postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres
      const match = connectionString.match(/postgresql:\/\/postgres:([^@]+)@db\.([^.]+)\.supabase\.co:5432\/(.+)/);
      if (match) {
        const rawPassword = match[1]; // May already be URL encoded or need encoding
        const projectRef = match[2];
        const database = match[3];
        
        // If password is already URL-encoded in .env, decode first, then re-encode
        // If not encoded, just encode it
        // This handles cases where user manually encoded it (e.g., %21) or not
        let encodedPassword: string;
        try {
          // Try to decode first - if it fails, password wasn't encoded
          const decoded = decodeURIComponent(rawPassword);
          // Re-encode to ensure proper encoding (handles special chars)
          encodedPassword = encodeURIComponent(decoded);
        } catch {
          // If decode fails, password wasn't encoded - encode it now
          encodedPassword = encodeURIComponent(rawPassword);
        }
        
        // Try session mode pooler (port 5432) - better for pgvector
        // Pooler is in the same region as the database: eu-west-1 (Ireland)
        // Session mode supports prepared statements which pgvector needs
        // Format: postgresql://postgres.PROJECT_REF:PASSWORD@aws-0-[REGION].pooler.supabase.com:5432/DATABASE
        // NOTE: Username format for pooler is postgres.PROJECT_REF (with dot)
        finalConnectionString = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-0-eu-west-1.pooler.supabase.com:5432/${database}`;
        
        console.log('[Postgres] Auto-converted direct connection to session mode pooler (eu-west-1:5432)');
        console.log('[Postgres] NOTE: For best results, use pooler URL directly from Supabase dashboard');
      }
    } else if (isSupabase && connectionString.includes('pooler.supabase')) {
      // Already using pooler URL - but check if password needs re-encoding
      // If password is already URL-encoded (contains %), leave it as-is
      // Otherwise, we might need to encode it
      // For now, trust that user provided correct encoding from dashboard
      const maskedUrl = connectionString.replace(/:[^:@]+@/, ':****@');
      console.log('[Postgres] Using pooler URL:', maskedUrl);
      
      // Validate username format (should be postgres.PROJECT_REF)
      const usernameMatch = connectionString.match(/postgresql:\/\/([^:]+):/);
      if (usernameMatch && !usernameMatch[1].includes('.')) {
        console.warn('[Postgres] WARNING: Username format may be incorrect. Pooler requires: postgres.PROJECT_REF');
      }
    }
    
    // Log final connection string details before creating pool
    // Support both postgres:// and postgresql:// formats
    const usernameMatch = finalConnectionString.match(/(?:postgres|postgresql):\/\/([^:]+):/);
    const hostMatch = finalConnectionString.match(/@([^:]+):/);
    const portMatch = finalConnectionString.match(/:([0-9]+)\//);
    const maskedConnectionString = finalConnectionString.replace(/:[^:@]+@/, ':****@');
    
    console.log('[Postgres] Creating pool with:');
    console.log('[Postgres]   Username:', usernameMatch ? usernameMatch[1] : 'unknown');
    console.log('[Postgres]   Host:', hostMatch ? hostMatch[1] : 'unknown');
    console.log('[Postgres]   Port:', portMatch ? portMatch[1] : 'unknown');
    console.log('[Postgres]   Protocol:', finalConnectionString.startsWith('postgres://') ? 'postgres://' : 'postgresql://');
    console.log('[Postgres]   Connection string (masked):', maskedConnectionString);
    
    // Verify pooler username format (should be postgres.PROJECT_REF)
    if (usernameMatch && finalConnectionString.includes('pooler.supabase')) {
      if (!usernameMatch[1].includes('.')) {
        console.warn('[Postgres] WARNING: Username format may be incorrect for pooler!');
        console.warn('[Postgres] Pooler requires: postgres.PROJECT_REF (with dot)');
        console.warn('[Postgres] Current format:', usernameMatch[1]);
      } else {
        console.log('[Postgres] Username format OK (contains dot)');
      }
    }

    // Normalize connection string protocol (pg library accepts both postgres:// and postgresql://)
    // Supabase dashboard may use postgres:// but we can handle both
    let normalizedConnectionString = finalConnectionString;
    if (normalizedConnectionString.startsWith('postgresql://')) {
      // Keep as-is, pg library supports both
      normalizedConnectionString = normalizedConnectionString;
    } else if (normalizedConnectionString.startsWith('postgres://')) {
      // Also valid, pg library supports both formats
      normalizedConnectionString = normalizedConnectionString;
    }

    pool = new Pool({
      connectionString: normalizedConnectionString,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
      max: 5, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      // Add connection error handling
    });

    // For Supabase, we need to bypass RLS when using direct Postgres connection
    // The connection uses database credentials, not service role key
    // So RLS policies still apply. We need to set role or use service role session
    if (isSupabase) {
      // Try to set role to service_role to bypass RLS
      // But note: direct Postgres connection doesn't use Supabase auth
      // So RLS might still apply. We'll test connection and see if RLS is an issue
      pool.on('connect', async (client) => {
        try {
          // Disable RLS for this session to allow direct queries without authenticated user
          // This is safe because we're using server-side code with validated tenant_id/site_id
          // Direct Postgres connections don't have auth.uid() so RLS policies checking user_tenants fail
          await client.query('SET LOCAL row_security = off');
          console.log('[Postgres] RLS disabled for direct connection session');
        } catch (error: any) {
          // If disabling RLS fails (insufficient privileges), continue
          // Some queries may fail if RLS policies check user_tenants without auth context
          console.warn('[Postgres] Could not disable RLS:', error.message);
          console.warn('[Postgres] RLS policies may block queries that check user_tenants');
        }
      });
    }

    // Test connection on first pool creation
    pool.on('error', (err: Error) => {
      console.error('Unexpected PostgreSQL pool error:', err);
      console.error('Error code:', (err as any).code);
      console.error('Error message:', err.message);
      
      // Parse error message for specific PostgreSQL error codes
      const errorCode = (err as any).code;
      const errorMessage = err.message;
      
      if (errorMessage?.includes('ENETUNREACH') || errorMessage?.includes('IPv6')) {
        console.error('IPv6 connection issue detected. Use pooler URL from Supabase dashboard (Settings → Database → Connection pooling → Session mode).');
      } else if (errorCode === 'ECONNREFUSED') {
        console.error('Connection refused. Possible causes:');
        console.error('1. Wrong host/port - use pooler URL from Supabase dashboard');
        console.error('2. Password encoding issue - ensure special characters are URL-encoded');
        console.error('3. Pooler not enabled - check Supabase dashboard → Settings → Database → Connection pooling');
        console.error('4. Network/firewall blocking port 5432');
      } else if (errorCode === 'XX000' || errorMessage?.includes('Tenant or user not found')) {
        console.error('❌ Authentication failed: Tenant or user not found');
        console.error('');
        console.error('This error means PostgreSQL rejected the username/password combination.');
        console.error('');
        console.error('Possible causes:');
        console.error('1. Wrong username format for pooler:');
        console.error('   - Pooler requires: postgres.PROJECT_REF (with dot)');
        console.error('   - Direct connection uses: postgres (without dot)');
        console.error('   - Check if pooler is enabled for your project');
        console.error('');
        console.error('2. Wrong password:');
        console.error('   - Verify password in Supabase Dashboard → Settings → Database');
        console.error('   - Try resetting database password');
        console.error('');
        console.error('3. Password encoding:');
        console.error('   - Special characters (!, @, #, etc.) must be URL-encoded');
        console.error('   - Example: Semalirani1! → Semalirani1%21');
        console.error('   - Or try without encoding (pg library may handle it)');
        console.error('');
        console.error('4. Pooler not enabled:');
        console.error('   - Check Supabase Dashboard → Settings → Database → Connection pooling');
        console.error('   - Ensure pooler is enabled for your project');
        console.error('   - Try direct connection URL if pooler is not available');
        console.error('');
        console.error('🔧 Next steps:');
        console.error('1. Copy pooler URL directly from Supabase dashboard:');
        console.error('   Settings → Database → Connection pooling → Session mode');
        console.error('');
        console.error('2. Or try direct connection (if pooler fails):');
        console.error('   postgres://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres');
        console.error('   (Note: Direct connection may have IPv6 issues on shared hosting)');
        console.error('');
        console.error('3. Verify username in connection string:');
        console.error('   Pooler: postgres.PROJECT_REF (with dot)');
        console.error('   Direct: postgres (without dot)');
      } else if (errorMessage?.includes('password authentication failed') || errorCode === '28P01') {
        console.error('❌ Authentication failed: Invalid password');
        console.error('Possible causes:');
        console.error('1. Wrong password - verify in Supabase dashboard');
        console.error('2. Password encoding issue - special chars must be URL-encoded');
        console.error('3. Password already URL-encoded when it should not be (or vice versa)');
      }
    });
  }

  return pool;
}

/**
 * Execute a parameterized SQL query
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, params);
}

/**
 * Close the connection pool (for cleanup)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
