/**
 * GET /api/chat/settings - Get chat settings for a site
 * PUT /api/chat/settings - Update chat settings for a site
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

    // Get chat settings
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('site_id', siteId)
      .eq('key', 'chat')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      // Return defaults if no settings found
      return NextResponse.json({
        title: 'AI Assistant',
        welcome_message: 'Hello! I am your AI assistant. How can I help you today?',
        input_placeholder: 'Type your message...',
        send_button_text: 'Send',
        avatar_url: null,
      });
    }

    const chatSettings = data.value as any;
    return NextResponse.json({
      title: chatSettings.title || 'AI Assistant',
      welcome_message: chatSettings.welcome_message || 'Hello! I am your AI assistant. How can I help you today?',
      input_placeholder: chatSettings.input_placeholder || 'Type your message...',
      send_button_text: chatSettings.send_button_text || 'Send',
      avatar_url: chatSettings.avatar_url || null,
    });
  } catch (error) {
    console.error('Chat settings GET error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch chat settings',
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
      title,
      welcome_message,
      input_placeholder,
      send_button_text,
      avatar_url,
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
      .eq('key', 'chat')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const currentSettings = existing?.value || {};
    const newSettings = {
      ...currentSettings,
      title: title !== undefined ? title : currentSettings.title,
      welcome_message: welcome_message !== undefined ? welcome_message : currentSettings.welcome_message,
      input_placeholder: input_placeholder !== undefined ? input_placeholder : currentSettings.input_placeholder,
      send_button_text: send_button_text !== undefined ? send_button_text : currentSettings.send_button_text,
      avatar_url: avatar_url !== undefined ? avatar_url : currentSettings.avatar_url,
    };

    // Deactivate old settings
    if (existing) {
      await supabaseAdmin
        .from('settings')
        .update({ is_active: false })
        .eq('site_id', site_id)
        .eq('key', 'chat')
        .eq('is_active', true);
    }

    // Insert new settings version
    const { error: insertError } = await supabaseAdmin.from('settings').insert({
      site_id: site_id,
      tenant_id: site.tenant_id,
      key: 'chat',
      value: newSettings,
      version: (existing?.version || 0) + 1,
      is_active: true,
    });

    if (insertError) {
      throw new Error(`Failed to update chat settings: ${insertError.message}`);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Chat settings PUT error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Failed to update chat settings',
        },
      },
      { status: 500 }
    );
  }
}
