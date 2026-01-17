/**
 * API Route: Check if user is super admin
 * Used for client-side super admin role verification
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { isSuperAdmin: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use admin client to bypass RLS for platform_users table
    const supabaseAdmin = createAdminClient();
    const { data: platformUser, error } = await supabaseAdmin
      .from('platform_users')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .single();

    if (error) {
      console.error('Error checking platform_users:', error);
      // If no rows found, error will be "PGRST116" - that's OK
      if (error.code !== 'PGRST116') {
        console.error('Unexpected error:', error);
      }
      return NextResponse.json({ isSuperAdmin: false, error: error.message });
    }

    if (!platformUser) {
      return NextResponse.json({ isSuperAdmin: false });
    }

    return NextResponse.json({ isSuperAdmin: true, role: platformUser.role });
  } catch (error) {
    console.error('Error checking super admin:', error);
    return NextResponse.json(
      { isSuperAdmin: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
