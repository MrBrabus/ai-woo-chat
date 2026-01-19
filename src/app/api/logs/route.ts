/**
 * GET /api/logs
 * 
 * Read recent log entries from log files
 * Useful for debugging production issues
 * 
 * Query params:
 * - limit: number of entries to return (default: 100)
 * - level: filter by level (info, warn, error, debug)
 */

import { NextRequest, NextResponse } from 'next/server';
import { readRecentLogs } from '@/lib/utils/file-logger';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const level = searchParams.get('level') as 'info' | 'warn' | 'error' | 'debug' | undefined;

    const logs = await readRecentLogs(limit, level);

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs,
    });
  } catch (error) {
    console.error('Failed to read logs:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to read logs',
      },
      { status: 500 }
    );
  }
}
