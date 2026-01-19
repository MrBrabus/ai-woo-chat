/**
 * Test script for Supabase Postgres connection
 * Run: node test-db-connection.js
 */

const { Client } = require('pg');
const { readFileSync } = require('fs');
const { join } = require('path');

// Load environment variables from .env.production
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env.production');
    const envContent = readFileSync(envPath, 'utf-8');
    const lines = envContent.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    console.error('Could not load .env.production:', error.message);
  }
}

// Load environment
loadEnv();

// Get connection string
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ SUPABASE_DB_URL or DATABASE_URL not found in environment');
  process.exit(1);
}

// Mask password in connection string for logging
const maskedString = connectionString.replace(/:[^:@]+@/, ':****@');
console.log('🔍 Testing connection with:', maskedString);
console.log('');

// Test connection
(async () => {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    console.log('⏳ Attempting connection...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    console.log('⏳ Testing query...');
    const result = await client.query('SELECT version(), current_database(), current_user');
    console.log('✅ Query executed successfully!');
    console.log('');
    console.log('📊 Results:');
    console.log('  Database:', result.rows[0].current_database);
    console.log('  User:', result.rows[0].current_user);
    console.log('  PostgreSQL Version:', result.rows[0].version.split(',')[0]);
    
    // Test pgvector extension
    try {
      const vectorTest = await client.query('SELECT extname, extversion FROM pg_extension WHERE extname = \'vector\'');
      if (vectorTest.rows.length > 0) {
        console.log('  pgvector:', vectorTest.rows[0].extversion, '✅');
      } else {
        console.log('  pgvector: Not installed ⚠️');
      }
    } catch (e) {
      console.log('  pgvector: Could not check ⚠️');
    }
    
    console.log('');
    console.log('✅ All tests passed!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Connection failed!');
    console.error('');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('');
      console.error('💡 Possible causes:');
      console.error('  1. Hosting provider blocking outbound TCP on port 5432');
      console.error('  2. Firewall blocking connection to pooler host');
      console.error('  3. Wrong host/port in connection string');
      console.error('');
      console.error('🔧 Solutions:');
      console.error('  1. Contact hosting support to allow outbound TCP to aws-0-eu-west-1.pooler.supabase.com:5432');
      console.error('  2. Check if password is correctly URL-encoded (special chars like ! → %21)');
      console.error('  3. Verify connection string from Supabase Dashboard → Settings → Database → Connection pooling → Session');
    } else if (error.code === 'ENETUNREACH') {
      console.error('');
      console.error('💡 Possible causes:');
      console.error('  1. IPv6 connection attempt (host doesn\'t support IPv6)');
      console.error('  2. Network unreachable');
      console.error('');
      console.error('🔧 Solutions:');
      console.error('  1. Ensure using pooler URL (not direct db. connection)');
      console.error('  2. Contact hosting support about IPv6/IPv4 support');
    } else if (error.code === '28P01' || error.message.includes('password')) {
      console.error('');
      console.error('💡 Possible causes:');
      console.error('  1. Incorrect password');
      console.error('  2. Password not URL-encoded (special chars need encoding)');
      console.error('');
      console.error('🔧 Solutions:');
      console.error('  1. Check password in Supabase Dashboard');
      console.error('  2. URL-encode special characters (! → %21, @ → %40, etc.)');
    }
    
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  } finally {
    await client.end();
  }
})();
