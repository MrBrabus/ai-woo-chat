/**
 * POST /api/logs/client
 * 
 * Receive client-side logs from widget/browser
 * Useful for debugging frontend issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeLogToFile } from '@/lib/utils/file-logger';
import type { LogEntry } from '@/lib/utils/logger';

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to process client log:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process log' },
      { status: 500 }
    );
  }
}
