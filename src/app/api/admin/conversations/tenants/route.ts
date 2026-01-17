/**
 * API Route: Get all tenants with conversation counts
 * Super admin only
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/auth/check-super-admin';
import { NextResponse } from 'next/server';

export async function GET() {
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

    // Fetch all tenants
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from('tenants')
      .select('id, name, slug, status')
      .order('name', { ascending: true });

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError);
      return NextResponse.json({ error: 'Failed to fetch tenants' }, { status: 500 });
    }

    // Get conversation count per tenant
    const tenantsWithCounts = await Promise.all(
      (tenants || []).map(async (tenant) => {
        // Get all licenses for this tenant
        const { data: licenses } = await supabaseAdmin
          .from('licenses')
          .select('id')
          .eq('tenant_id', tenant.id);

        const licenseIds = licenses?.map(l => l.id) || [];

        if (licenseIds.length === 0) {
          return { ...tenant, conversation_count: 0 };
        }

        // Get all sites for these licenses
        const { data: sites } = await supabaseAdmin
          .from('sites')
          .select('id')
          .in('license_id', licenseIds);

        const siteIds = sites?.map(s => s.id) || [];

        if (siteIds.length === 0) {
          return { ...tenant, conversation_count: 0 };
        }

        // Count conversations for these sites
        const { count } = await supabaseAdmin
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .in('site_id', siteIds);

        return {
          ...tenant,
          conversation_count: count || 0,
        };
      })
    );

    return NextResponse.json({ tenants: tenantsWithCounts });
  } catch (error) {
    console.error('Error in GET /api/admin/conversations/tenants:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
