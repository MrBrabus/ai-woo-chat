/**
 * GET /api/sales/settings - Get sales settings for a site
 * PUT /api/sales/settings - Update sales settings for a site
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

    // Get sales settings
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('site_id', siteId)
      .eq('key', 'sales')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return defaults if no settings found
      return NextResponse.json({
        enable_product_recommendations: true,
        max_recommendations: 3,
        upsell_enabled: false,
        cross_sell_enabled: true,
        urgency_messages: false,
        discount_prompts: false,
      });
    }

    const salesSettings = data.value as any;
    return NextResponse.json({
      enable_product_recommendations: salesSettings.enable_product_recommendations ?? true,
      max_recommendations: salesSettings.max_recommendations ?? 3,
      upsell_enabled: salesSettings.upsell_enabled ?? false,
      cross_sell_enabled: salesSettings.cross_sell_enabled ?? true,
      urgency_messages: salesSettings.urgency_messages ?? false,
      discount_prompts: salesSettings.discount_prompts ?? false,
    });
  } catch (error) {
    console.error('Sales settings GET error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch sales settings',
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
      enable_product_recommendations,
      max_recommendations,
      upsell_enabled,
      cross_sell_enabled,
      urgency_messages,
      discount_prompts,
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
      .eq('key', 'sales')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const currentSettings = existing?.value || {};
    const newSettings = {
      ...currentSettings,
      enable_product_recommendations:
        enable_product_recommendations !== undefined
          ? enable_product_recommendations
          : currentSettings.enable_product_recommendations,
      max_recommendations:
        max_recommendations !== undefined ? max_recommendations : currentSettings.max_recommendations,
      upsell_enabled: upsell_enabled !== undefined ? upsell_enabled : currentSettings.upsell_enabled,
      cross_sell_enabled:
        cross_sell_enabled !== undefined ? cross_sell_enabled : currentSettings.cross_sell_enabled,
      urgency_messages:
        urgency_messages !== undefined ? urgency_messages : currentSettings.urgency_messages,
      discount_prompts:
        discount_prompts !== undefined ? discount_prompts : currentSettings.discount_prompts,
    };

    // Deactivate old settings
    if (existing) {
      await supabaseAdmin
        .from('settings')
        .update({ is_active: false })
        .eq('site_id', site_id)
        .eq('key', 'sales')
        .eq('is_active', true);
    }

    // Insert new settings version
    const { error: insertError } = await supabaseAdmin.from('settings').insert({
      site_id: site_id,
      tenant_id: site.tenant_id,
      key: 'sales',
      value: newSettings,
      version: (existing?.version || 0) + 1,
      is_active: true,
    });

    if (insertError) {
      throw new Error(`Failed to update sales settings: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Sales settings PUT error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update sales settings',
        },
      },
      { status: 500 }
    );
  }
}
