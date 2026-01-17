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

      return NextResponse.json(
        {
          error: validation.error,
        },
        { status: statusCode }
      );
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
      return NextResponse.json(
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
    }

    // Call the actual handler
    const startTime = Date.now();
    let usageEvent: UsageEventData | null = null;
    let response: Response;

    try {
      response = await handler(request);

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

      usageEvent = {
        tenant_id: site.tenant_id,
        site_id,
        conversation_id: conversation_id || null,
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
      usageEvent = {
        tenant_id: site.tenant_id,
        site_id,
        conversation_id: conversation_id || null,
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

    return response;
  } catch (error) {
    console.error('Usage enforcement error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while processing your request',
        },
      },
      { status: 500 }
    );
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
