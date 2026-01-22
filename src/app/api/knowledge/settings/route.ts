/**
 * GET /api/knowledge/settings - Get knowledge settings for a site
 * PUT /api/knowledge/settings - Update knowledge settings for a site
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
      .select('tenant_id')
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

    // Get knowledge settings
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('site_id', siteId)
      .eq('key', 'knowledge')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return defaults if no settings found
      return NextResponse.json({
        include_products: true,
        include_pages: true,
        include_policies: true,
        include_faq: false,
        auto_index_enabled: true,
        chunk_size: 1000,
        top_k_results: 10,
        similarity_threshold: 0.5,
        max_context_tokens: 4000,
        max_chunks_per_source: 3,
        max_sources: 5,
        embedding_model: 'text-embedding-3-small',
        recency_bias: false,
      });
    }

    const knowledgeSettings = data.value as any;
    return NextResponse.json({
      include_products: knowledgeSettings.include_products ?? true,
      include_pages: knowledgeSettings.include_pages ?? true,
      include_policies: knowledgeSettings.include_policies ?? true,
      include_faq: knowledgeSettings.include_faq ?? false,
      auto_index_enabled: knowledgeSettings.auto_index_enabled ?? true,
      chunk_size: knowledgeSettings.chunk_size ?? 1000,
      top_k_results: knowledgeSettings.top_k_results ?? 10,
      similarity_threshold: knowledgeSettings.similarity_threshold ?? 0.5,
      max_context_tokens: knowledgeSettings.max_context_tokens ?? 4000,
      max_chunks_per_source: knowledgeSettings.max_chunks_per_source ?? 3,
      max_sources: knowledgeSettings.max_sources ?? 5,
      embedding_model: knowledgeSettings.embedding_model || 'text-embedding-3-small',
      recency_bias: knowledgeSettings.recency_bias ?? false,
    });
  } catch (error) {
    console.error('Knowledge settings GET error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch knowledge settings',
        },
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
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

    const body = await req.json();
    const {
      site_id,
      include_products,
      include_pages,
      include_policies,
      include_faq,
      auto_index_enabled,
      chunk_size,
      top_k_results,
      similarity_threshold,
      max_context_tokens,
      max_chunks_per_source,
      max_sources,
      embedding_model,
      recency_bias,
    } = body;

    if (!site_id) {
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
      .select('tenant_id')
      .eq('id', site_id)
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

    // Get current settings
    const { data: existing } = await supabaseAdmin
      .from('settings')
      .select('value, version')
      .eq('site_id', site_id)
      .eq('key', 'knowledge')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const currentSettings = existing?.value || {};
    const newSettings = {
      ...currentSettings,
      include_products:
        include_products !== undefined ? include_products : (currentSettings.include_products !== false),
      include_pages: include_pages !== undefined ? include_pages : (currentSettings.include_pages !== false),
      include_policies:
        include_policies !== undefined ? include_policies : (currentSettings.include_policies !== false),
      include_faq: include_faq !== undefined ? include_faq : currentSettings.include_faq,
      auto_index_enabled:
        auto_index_enabled !== undefined ? auto_index_enabled : (currentSettings.auto_index_enabled !== false),
      chunk_size: chunk_size !== undefined ? chunk_size : (currentSettings.chunk_size || 1000),
      top_k_results:
        top_k_results !== undefined ? top_k_results : (currentSettings.top_k_results || 10),
      similarity_threshold:
        similarity_threshold !== undefined ? similarity_threshold : (currentSettings.similarity_threshold ?? 0.5),
      max_context_tokens:
        max_context_tokens !== undefined ? max_context_tokens : (currentSettings.max_context_tokens ?? 4000),
      max_chunks_per_source:
        max_chunks_per_source !== undefined ? max_chunks_per_source : (currentSettings.max_chunks_per_source ?? 3),
      max_sources:
        max_sources !== undefined ? max_sources : (currentSettings.max_sources ?? 5),
      embedding_model:
        embedding_model !== undefined ? embedding_model : (currentSettings.embedding_model || 'text-embedding-3-small'),
      recency_bias:
        recency_bias !== undefined ? recency_bias : (currentSettings.recency_bias ?? false),
    };

    // Deactivate old settings
    if (existing) {
      await supabaseAdmin
        .from('settings')
        .update({ is_active: false })
        .eq('site_id', site_id)
        .eq('key', 'knowledge')
        .eq('is_active', true);
    }

    // Insert new settings version
    const { error: insertError } = await supabaseAdmin.from('settings').insert({
      site_id: site_id,
      tenant_id: site.tenant_id,
      key: 'knowledge',
      value: newSettings,
      version: (existing?.version || 0) + 1,
      is_active: true,
    });

    if (insertError) {
      throw new Error(`Failed to update knowledge settings: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Knowledge settings PUT error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update knowledge settings',
        },
      },
      { status: 500 }
    );
  }
}
