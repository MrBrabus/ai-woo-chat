/**
 * Supabase client for browser/client-side usage
 * Uses anon key and handles auth state
 */

import { createBrowserClient } from '@supabase/ssr';
import { Database } from './types';

export function createClient() {
  // Check if we're in browser environment
  if (typeof window === 'undefined') {
    throw new Error('createClient() can only be called in browser/client components');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Missing Supabase environment variables:', {
      hasUrl: !!url,
      hasKey: !!key,
    });
    throw new Error(
      'Missing Supabase environment variables. Please check your .env.local file and ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
    );
  }

  try {
    // createBrowserClient from @supabase/ssr only needs URL and key
    // It does NOT require cookies (that's for createServerClient)
    const client = createBrowserClient<Database>(url, key);
    
    if (!client) {
      throw new Error('createBrowserClient returned undefined');
    }
    
    if (!client.auth) {
      throw new Error('Supabase client does not have auth property');
    }
    
    return client;
  } catch (error) {
    console.error('Error creating Supabase client:', error);
    throw error;
  }
}
