/**
 * Auth helper functions
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Get current authenticated user
 * Redirects to login if not authenticated
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return user;
}

/**
 * Get current user without redirecting
 * Returns null if not authenticated
 */
export async function getCurrentUserOptional() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return !!user;
}

/**
 * Sign out current user
 */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
