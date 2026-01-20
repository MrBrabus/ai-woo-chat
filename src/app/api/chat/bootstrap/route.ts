/**
 * POST /api/chat/bootstrap
 * Chat bootstrap endpoint with runtime validation
 * 
 * Initializes a chat session and returns visitor/conversation IDs
 * Uses runtime validation middleware to check site status, license, and CORS
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRuntimeValidation } from '@/middleware/runtime-validation';
import { bootstrapSession } from '@/lib/chat/session';

async function bootstrapHandler(
  req: NextRequest,
  site_id: string,
  site: any,
  license: any
): Promise<Response> {
  try {
    // Body may have been read by middleware, try to parse it
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body already consumed, use empty object
      // site_id is already provided as parameter
    }
    const { visitor_id, conversation_id } = body;

    // Bootstrap session (get or create visitor/conversation)
    const sessionInfo = await bootstrapSession(
      site_id,
      visitor_id,
      conversation_id
    );

    // Get chat settings
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();
    const { data: chatSettingsData } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('site_id', site_id)
      .eq('key', 'chat')
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();

    const chatSettings = chatSettingsData?.value || {};
    const chatConfig = {
      title: chatSettings.title || 'AI Assistant',
      welcome_message: chatSettings.welcome_message || 'Hello! I am your AI assistant. How can I help you today?',
      input_placeholder: chatSettings.input_placeholder || 'Type your message...',
      send_button_text: chatSettings.send_button_text || 'Send',
      avatar_url: chatSettings.avatar_url || null,
    };

    const response = NextResponse.json({
      visitor_id: sessionInfo.visitorId,
      conversation_id: sessionInfo.conversationId,
      welcome_back: sessionInfo.welcomeBack,
      session: sessionInfo.session,
      chat_config: chatConfig,
    });

    // Add CORS headers
    const origin = req.headers.get('origin');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    }

    return response;
  } catch (error) {
    console.error('Bootstrap error:', error);
    const response = NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to bootstrap chat session',
        },
      },
      { status: 500 }
    );

    // Add CORS headers even for errors
    const origin = req.headers.get('origin');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    }

    return response;
  }
}

// Export OPTIONS handler for CORS preflight (handled by runtime validation middleware)
// But we also need explicit export for Next.js routing
export async function OPTIONS(req: NextRequest) {
  // This should be handled by withRuntimeValidation, but if middleware doesn't catch it,
  // handle it here as fallback
  const origin = req.headers.get('origin');
  if (origin) {
    const response = new NextResponse(null, { status: 204 });
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Origin');
    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Max-Age', '86400');
    return response;
  }
  return new NextResponse(null, { status: 403 });
}

// Export with runtime validation
export const POST = withRuntimeValidation(bootstrapHandler);
