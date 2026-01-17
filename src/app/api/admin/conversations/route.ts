/**
 * API Route: Get conversations filtered by tenant and/or search
 * Super admin only
 * 
 * Query params:
 * - tenant_id: Filter by tenant ID
 * - search: Search conversation IDs (optional)
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/auth/check-super-admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenant_id');
    const search = searchParams.get('search') || '';

    if (!tenantId) {
      return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();

    // Get all licenses for this tenant
    const { data: licenses } = await supabaseAdmin
      .from('licenses')
      .select('id')
      .eq('tenant_id', tenantId);

    const licenseIds = licenses?.map(l => l.id) || [];

    if (licenseIds.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    // Get all sites for these licenses
    const { data: sites } = await supabaseAdmin
      .from('sites')
      .select('id')
      .in('license_id', licenseIds);

    const siteIds = sites?.map(s => s.id) || [];

    if (siteIds.length === 0) {
      return NextResponse.json({ conversations: [] });
    }

    // Build query
    let query = supabaseAdmin
      .from('conversations')
      .select(`
        id,
        conversation_id,
        site_id,
        visitor_id,
        started_at,
        last_message_at,
        message_count,
        created_at,
        sites (
          id,
          site_url,
          site_name,
          license_id,
          licenses (
            id,
            license_key,
            customer_email
          )
        )
      `)
      .in('site_id', siteIds)
      .order('last_message_at', { ascending: false })
      .limit(1000); // Increased limit for search results

    // Apply search filter if provided
    if (search.trim()) {
      query = query.ilike('conversation_id', `%${search.trim()}%`);
    }

    const { data: conversations, error } = await query;

    if (error) {
      console.error('Error fetching conversations:', error);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    // Process and flatten nested structure
    const conversationsWithDetails = (conversations || []).map((conv: any) => {
      const site = Array.isArray(conv.sites) ? conv.sites[0] : conv.sites;
      const license = Array.isArray(site?.licenses) ? site.licenses[0] : site?.licenses;

      return {
        id: conv.id,
        conversation_id: conv.conversation_id,
        site_id: conv.site_id,
        visitor_id: conv.visitor_id,
        started_at: conv.started_at,
        last_message_at: conv.last_message_at,
        message_count: conv.message_count,
        created_at: conv.created_at,
        site: site ? {
          id: site.id,
          site_url: site.site_url,
          site_name: site.site_name,
          license_id: site.license_id,
          license: license || null,
        } : null,
      };
    }).filter((conv: any) => conv.site !== null);

    return NextResponse.json({ conversations: conversationsWithDetails });
  } catch (error) {
    console.error('Error in GET /api/admin/conversations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
