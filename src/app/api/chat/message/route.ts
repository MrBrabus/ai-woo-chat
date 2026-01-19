/**
 * POST /api/chat/message
 * Chat message endpoint with usage enforcement
 * 
 * Streams AI responses via Server-Sent Events (SSE) with:
 * - RAG pipeline for context retrieval
 * - OpenAI streaming
 * - Live product verification
 * - Message persistence
 */

import { NextRequest, NextResponse } from 'next/server';
import { withUsageEnforcement } from '@/middleware/usage-enforcement';
import { processChatMessage, saveMessage } from '@/lib/chat/message-handler';
import { createLogger, generateRequestId } from '@/lib/utils/logger';

async function chatMessageHandler(req: NextRequest): Promise<Response> {
  const requestId = generateRequestId();
  const logger = createLogger({ request_id: requestId });

  try {
    // Body may have been read by middleware, try to parse it
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body already consumed
    }

    const { site_id, visitor_id, conversation_id, message } = body;

    logger.info('Chat message received', {
      site_id,
      visitor_id,
      conversation_id,
      message_length: message?.length || 0,
    });

    // Validate required fields
    if (!visitor_id || !conversation_id || !message) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'visitor_id, conversation_id, and message are required',
          },
        },
        { status: 400 }
      );
    }

    // Get site and license info (usage-enforcement already validated runtime)
    const { createAdminClient } = await import('@/lib/supabase/server');
    const supabaseAdmin = createAdminClient();

    const { data: site } = await supabaseAdmin
      .from('sites')
      .select('*, license:licenses(*)')
      .eq('id', site_id)
      .single();

    if (!site) {
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

    const license = site.license as any;

    const { data: visitor } = await supabaseAdmin
      .from('visitors')
      .select('id')
      .eq('site_id', site_id)
      .eq('visitor_id', visitor_id)
      .single();

    if (!visitor) {
      return NextResponse.json(
        {
          error: {
            code: 'VISITOR_NOT_FOUND',
            message: 'Visitor not found. Please bootstrap session first.',
          },
        },
        { status: 404 }
      );
    }

    const { data: conversation } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('site_id', site_id)
      .eq('conversation_id', conversation_id)
      .single();

    if (!conversation) {
      return NextResponse.json(
        {
          error: {
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found. Please bootstrap session first.',
          },
        },
        { status: 404 }
      );
    }

    // Save user message first
    await saveMessage(
      site_id,
      conversation_id,
      'user',
      message,
      undefined,
      undefined,
      undefined,
      undefined
    );

    // Create AbortController for request cancellation
    const abortController = new AbortController();
    
    // Handle client disconnect
    req.signal.addEventListener('abort', () => {
      abortController.abort();
      logger.info('Request aborted by client');
    });

    // Process message with RAG and OpenAI (with abort signal)
    const { stream, evidence, tokenUsage, fullResponsePromise } = await processChatMessage(
      {
        siteId: site_id,
        visitorId: visitor_id,
        conversationId: conversation_id,
        message,
        site,
        license,
      },
      abortController.signal
    );

    // Save assistant message after streaming completes
    fullResponsePromise
      .then((fullResponse) => {
        if (fullResponse) {
          return saveMessage(
            site_id,
            conversation_id,
            'assistant',
            fullResponse,
            { evidence },
            tokenUsage,
            'gpt-4o',
            evidence
          );
        }
      })
      .catch((error) => {
        console.error('Error saving assistant message:', error);
      });

    // Get origin for CORS headers
    const origin = req.headers.get('origin');

    // Create response with token usage in headers (for usage tracking)
    const headers = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    if (origin) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Vary', 'Origin');
    }

    // Add token usage headers for usage-enforcement middleware
    if (tokenUsage.totalTokens > 0) {
      headers.set('X-Token-Usage-Prompt', tokenUsage.promptTokens.toString());
      headers.set('X-Token-Usage-Completion', tokenUsage.completionTokens.toString());
      headers.set('X-Token-Usage-Total', tokenUsage.totalTokens.toString());
    }

    return new Response(stream, { headers });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('Chat message error', { error: errorMessage, stack: errorStack });
    console.error('Chat message error details:', error);
    
    // Return error with more details for debugging (remove in production if needed)
    const origin = req.headers.get('origin');
    const response = NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while processing your message. Please try again.',
          // Include error message for debugging (temporarily enabled to diagnose 500 error)
          details: errorMessage,
        },
      },
      { status: 500 }
    );
    
    // Add CORS headers even for errors
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    }
    
    return response;
  }
}

// Export with usage enforcement
// Note: usage-enforcement already includes runtime validation and CORS handling
export const POST = withUsageEnforcement(chatMessageHandler);
