/**
 * Usage enforcement middleware for /api/chat/message
 * Checks license status and plan limits before processing requests
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  checkUsageLimits,
  logUsageEvent,
  updateDailyUsage,
  calculateCost,
  UsageEventData,
} from '../lib/usage-tracking';

// Initialize Supabase client with service role key (for bypassing RLS)
const supabaseAdmin = createAdminClient();

export interface ChatMessageRequest {
  site_id: string;
  visitor_id: string;
  conversation_id?: string;
  message: string;
}

/**
 * Middleware to enforce usage limits for chat messages
 * This should wrap the /api/chat/message handler
 */
export async function enforceUsageLimits(
  request: NextRequest,
  handler: (req: NextRequest) => Promise<Response>
): Promise<Response> {
  try {
    const body: ChatMessageRequest = await request.json();
    const { site_id, conversation_id } = body;

    if (!site_id) {
      const response = NextResponse.json(
        {
          error: {
            code: 'MISSING_REQUIRED_FIELD',
            message: 'site_id is required',
          },
        },
        { status: 400 }
      );
      // Add CORS headers even for errors
      const origin = request.headers.get('origin');
      if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Vary', 'Origin');
      }
      return response;
    }

    // Validate runtime request (site status, license status, CORS)
    const { validateRuntimeRequest } = await import('./runtime-validation');
    const validation = await validateRuntimeRequest(request, site_id);

    if (!validation.allowed) {
      const statusCode =
        validation.error?.code === 'INVALID_ORIGIN' ||
        validation.error?.code === 'MISSING_ORIGIN'
          ? 403
          : validation.error?.code === 'SITE_NOT_FOUND'
          ? 404
          : 403;

      const response = NextResponse.json(
        {
          error: validation.error,
        },
        { status: statusCode }
      );
      // Add CORS headers even for errors (unless origin is invalid)
      const origin = request.headers.get('origin');
      if (origin && validation.error?.code !== 'INVALID_ORIGIN' && validation.error?.code !== 'MISSING_ORIGIN') {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Vary', 'Origin');
      }
      return response;
    }

    const site = validation.site!;
    const license = validation.license!;

    // Check usage limits (estimate tokens - we'll use a conservative estimate)
    // For chat, we estimate ~500 tokens for prompt + 500 for completion = 1000 tokens
    const estimated_tokens = 1000;
    const limitCheck = await checkUsageLimits(
      supabaseAdmin,
      site_id,
      'chat',
      estimated_tokens
    );

    if (!limitCheck.allowed) {
      // Return graceful error response (no streaming)
      const response = NextResponse.json(
        {
          error: {
            code: 'USAGE_LIMIT_EXCEEDED',
            message: limitCheck.reason || 'Daily usage limit reached',
            details: {
              current_usage: limitCheck.current_usage,
              limits: limitCheck.limits,
            },
          },
        },
        { status: 403 }
      );
      // Add CORS headers even for errors
      const origin = request.headers.get('origin');
      if (origin) {
        response.headers.set('Access-Control-Allow-Origin', origin);
        response.headers.set('Access-Control-Allow-Credentials', 'true');
        response.headers.set('Vary', 'Origin');
      }
      return response;
    }

    // Reconstruct request with body since we already read it
    const reconstructedRequest = new NextRequest(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(body),
    });

    // Call the actual handler
    const startTime = Date.now();
    let usageEvent: UsageEventData | null = null;
    let response: Response;

    try {
      response = await handler(reconstructedRequest);

      // For streaming responses (SSE), token usage is tracked in the handler
      // and passed via response headers or handled separately
      // For now, we'll use estimated values and update them if available from handler
      
      // Check if response has token usage in headers (if handler sets them)
      const promptTokensHeader = response.headers.get('X-Token-Usage-Prompt');
      const completionTokensHeader = response.headers.get('X-Token-Usage-Completion');
      const totalTokensHeader = response.headers.get('X-Token-Usage-Total');
      
      const prompt_tokens = promptTokensHeader ? parseInt(promptTokensHeader, 10) : 500;
      const completion_tokens = completionTokensHeader ? parseInt(completionTokensHeader, 10) : 500;
      const total_tokens = totalTokensHeader ? parseInt(totalTokensHeader, 10) : 1000;
      const latency_ms = Date.now() - startTime;

      // Lookup database conversation_id from external conversation_id (conv_xxx format)
      // Usage events table expects UUID (database id), not external conversation_id
      let dbConversationId: string | null = null;
      if (conversation_id && conversation_id.startsWith('conv_')) {
        try {
          const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('conversation_id', conversation_id)
            .eq('site_id', site_id)
            .single();
          if (conv) {
            dbConversationId = conv.id;
          }
        } catch {
          // Ignore lookup errors, just use null for usage events
        }
      }

      usageEvent = {
        tenant_id: site.tenant_id,
        site_id,
        conversation_id: dbConversationId || null,
        type: 'chat',
        model: 'gpt-4o',
        prompt_tokens,
        completion_tokens,
        total_tokens,
        latency_ms,
        success: response.ok,
        error_code: response.ok ? null : 'API_ERROR',
      };

      // Log usage event and update daily aggregate
      if (response.ok) {
        const cost = calculateCost(
          usageEvent.model,
          usageEvent.prompt_tokens,
          usageEvent.completion_tokens
        );

        await Promise.all([
          logUsageEvent(supabaseAdmin, usageEvent),
          updateDailyUsage(
            supabaseAdmin,
            site_id,
            site.tenant_id,
            'chat',
            total_tokens,
            cost
          ),
        ]);
      } else {
        // Log failed request
        await logUsageEvent(supabaseAdmin, usageEvent);
      }
    } catch (error) {
      // Log error
      const latency_ms = Date.now() - startTime;
      
      // Lookup database conversation_id for error logging
      let dbConversationId: string | null = null;
      if (conversation_id && conversation_id.startsWith('conv_')) {
        try {
          const { data: conv } = await supabaseAdmin
            .from('conversations')
            .select('id')
            .eq('conversation_id', conversation_id)
            .eq('site_id', site_id)
            .single();
          if (conv) {
            dbConversationId = conv.id;
          }
        } catch {
          // Ignore lookup errors
        }
      }

      usageEvent = {
        tenant_id: site.tenant_id,
        site_id,
        conversation_id: dbConversationId || null,
        type: 'chat',
        model: 'gpt-4o',
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        latency_ms,
        success: false,
        error_code: 'HANDLER_ERROR',
      };

      await logUsageEvent(supabaseAdmin, usageEvent);

      throw error;
    }

    // Add CORS headers to response
    const origin = request.headers.get('origin');
    if (origin && response) {
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
      headers.set('Vary', 'Origin');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return response;
  } catch (error) {
    console.error('Usage enforcement error:', error);
    const response = NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while processing your request',
        },
      },
      { status: 500 }
    );
    // Add CORS headers even for errors
    const origin = request.headers.get('origin');
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    }
    return response;
  }
}

/**
 * Helper to wrap a chat message handler with usage enforcement
 */
export function withUsageEnforcement(
  handler: (req: NextRequest) => Promise<Response>
) {
  return (req: NextRequest) => enforceUsageLimits(req, handler);
}
