/**
 * Environment variable loader for standalone builds
 * 
 * In Next.js standalone builds, .env.production is not automatically loaded at runtime.
 * This utility loads environment variables from .env.production file at startup.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

let envLoaded = false;

/**
 * Load environment variables from .env.production file
 * Only loads once, subsequent calls are no-ops
 */
export function loadEnvProduction(): void {
  if (envLoaded) {
    return;
  }

  try {
    // Try multiple possible locations for .env.production
    // In standalone builds, .env.production should be in the app root directory
    const cwd = process.cwd();
    const possiblePaths = [
      join(cwd, '.env.production'),
      join(cwd, '..', '.env.production'), // Parent directory (for standalone/.next/standalone/)
      join(cwd, '..', '..', '.env.production'), // Two levels up (for standalone builds)
      join(cwd, 'app', '.env.production'), // If in nodevenv/app.aiwoochat.com/
    ];
    
    let envPath: string | null = null;
    let envContent: string | null = null;
    
    for (const path of possiblePaths) {
      try {
        envContent = readFileSync(path, 'utf-8');
        envPath = path;
        console.log('[EnvLoader] Found .env.production at:', path);
        break;
      } catch {
        // Try next path
        continue;
      }
    }
    
    if (!envContent || !envPath) {
      throw new Error(`Could not find .env.production. Tried: ${possiblePaths.join(', ')}`);
    }
    
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }
      
      // Parse KEY=VALUE format
      const match = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        
        // Only set if not already set in process.env
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
    
    envLoaded = true;
    console.log('[EnvLoader] Loaded environment variables from .env.production');
    console.log('[EnvLoader] SUPABASE_DB_URL:', process.env.SUPABASE_DB_URL ? 'SET' : 'NOT SET');
  } catch (error) {
    // Log error for debugging
    const err = error as Error & { code?: string };
    if (err.code === 'ENOENT') {
      console.warn('[EnvLoader] .env.production file not found at:', envPath);
    } else {
      console.warn('[EnvLoader] Could not load .env.production:', err.message);
    }
  }
}
