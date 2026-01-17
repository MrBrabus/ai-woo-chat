/**
 * API Route: Get tenant details by ID
 * Super admin only
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/auth/check-super-admin';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { tenant_id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super admin
    const admin = await isSuperAdmin(user.id);
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseAdmin = createAdminClient();
    const { tenant_id } = params;

    // Fetch tenant details
    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, status, created_at')
      .eq('id', tenant_id)
      .single();

    if (error || !tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('Error in GET /api/admin/conversations/tenants/[tenant_id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
