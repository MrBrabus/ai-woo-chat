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

    return NextResponse.json({
      visitor_id: sessionInfo.visitorId,
      conversation_id: sessionInfo.conversationId,
      welcome_back: sessionInfo.welcomeBack,
      session: sessionInfo.session,
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to bootstrap chat session',
        },
      },
      { status: 500 }
    );
  }
}

// Export with runtime validation
export const POST = withRuntimeValidation(bootstrapHandler);
