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

    pool = new Pool({
      connectionString,
      ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
      max: 5, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
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
