/**
 * POST /api/logs/client
 * 
 * Receive client-side logs from widget/browser
 * Useful for debugging frontend issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeLogToFile } from '@/lib/utils/file-logger';
import type { LogEntry } from '@/lib/utils/logger';

// Handle OPTIONS preflight for CORS
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin) {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Origin',
        'Vary': 'Origin',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  return new NextResponse(null, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { level, message, context, error } = body;

    // Validate required fields
    if (!level || !message) {
      return NextResponse.json(
        { success: false, error: 'level and message are required' },
        { status: 400 }
      );
    }

    // Create log entry
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level as LogEntry['level'],
      message: `[CLIENT] ${message}`,
      context: {
        ...context,
        source: 'client',
        user_agent: req.headers.get('user-agent') || undefined,
        origin: req.headers.get('origin') || undefined,
      },
      error: error
        ? {
            name: error.name || 'Error',
            message: error.message || String(error),
            stack: error.stack,
          }
        : undefined,
    };

    // Write to file (async, don't wait)
    writeLogToFile(entry).catch(() => {
      // Ignore file write errors
    });

    const origin = req.headers.get('origin');
    const response = NextResponse.json({ success: true });
    
    // Add CORS headers
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
      response.headers.set('Vary', 'Origin');
    }
    
    return response;
  } catch (error) {
    console.error('Failed to process client log:', error);
    const origin = req.headers.get('origin');
    const response = NextResponse.json(
      { success: false, error: 'Failed to process log' },
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
