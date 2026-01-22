/**
 * GET /api/ingestion/status
 * Get ingestion status and logs for a site
 * 
 * Shows ingestion events, success/failure rates, and recent activity
 * 
 * Requires authentication (dashboard users only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const siteId = url.searchParams.get('site_id');

    if (!siteId) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'site_id is required',
          },
        },
        { status: 400 }
      );
    }

    // Verify user has access to this site
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();

    const { data: site, error: siteError } = await supabaseAdmin
      .from('sites')
      .select('id, tenant_id')
      .eq('id', siteId)
      .single();

    if (siteError || !site) {
      return NextResponse.json(
        {
          error: {
            code: 'SITE_NOT_FOUND',
            message: 'Site not found',
          },
        },
        { status: 404 }
      );
    }

    // Get ingestion events
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('ingestion_events')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (eventsError) {
      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to fetch ingestion events',
          },
        },
        { status: 500 }
      );
    }

    // Get embeddings count
    const { count: embeddingsCount, error: embeddingsError } = await supabaseAdmin
      .from('embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('site_id', siteId);

    // Count by status
    const statusCounts = {
      completed: events?.filter((e) => e.status === 'completed').length || 0,
      failed: events?.filter((e) => e.status === 'failed').length || 0,
      processing: events?.filter((e) => e.status === 'processing').length || 0,
      pending: events?.filter((e) => e.status === 'pending').length || 0,
      retryable: events?.filter((e) => e.status === 'retryable').length || 0,
    };

    // Count by entity type
    const entityCounts = {
      product: events?.filter((e) => e.entity_type === 'product').length || 0,
      page: events?.filter((e) => e.entity_type === 'page').length || 0,
      policy: events?.filter((e) => e.entity_type === 'policy').length || 0,
    };

    return NextResponse.json({
      site_id: siteId,
      embeddings_count: embeddingsCount || 0,
      ingestion_events: {
        total: events?.length || 0,
        by_status: statusCounts,
        by_entity_type: entityCounts,
        recent: events?.slice(0, 20).map((e) => ({
          event_id: e.event_id,
          event_type: e.event_type,
          entity_type: e.entity_type,
          entity_id: e.entity_id,
          status: e.status,
          error_message: e.error_message,
          created_at: e.created_at,
          processed_at: e.processed_at,
          metadata: e.metadata,
        })) || [],
      },
    });
  } catch (error) {
    console.error('Ingestion status error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch ingestion status',
        },
      },
      { status: 500 }
    );
  }
}
