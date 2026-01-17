/**
 * Check if user is super admin
 * 
 * Super admins have platform-level access to all tenants, licenses, and system data.
 * They can access admin sections in the dashboard and have full system permissions.
 */

import { createAdminClient } from '@/lib/supabase/server';

/**
 * Check if a user has super admin role
 * @param userId - User ID from auth.users
 * @returns true if user is super admin, false otherwise
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    
    const { data, error } = await supabase
      .from('platform_users')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'super_admin')
      .single();

    if (error || !data) {
      return false;
    }

    return data.role === 'super_admin';
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
}
