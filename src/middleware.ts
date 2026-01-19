/**
 * Next.js middleware
 * Handles Supabase auth session refresh for authenticated routes
 * 
 * Scope: Only runs on routes that may require auth (dashboard, API routes)
 * Does not block public routes or static assets
 */

import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Handle OPTIONS preflight for CORS endpoints
  if (request.method === 'OPTIONS' && (
    pathname === '/api/chat/bootstrap' ||
    pathname === '/api/chat/message' ||
    pathname === '/api/chat/events'
  )) {
    const origin = request.headers.get('origin');
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
  
  // Skip middleware for public widget endpoint (no auth required)
  if (pathname === '/api/widget') {
    return NextResponse.next();
  }
  
  // Only refresh session, don't block requests
  // Route protection is handled in layout.tsx and route handlers
  try {
    return await updateSession(request);
  } catch (error) {
    // If middleware fails (e.g., missing env vars), still allow request through
    // Route protection will handle authentication checks
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match routes that may require authentication:
     * - Dashboard routes (/dashboard/*)
     * - API routes (/api/*)
     * 
     * Exclude:
     * - _next/* (Next.js internals)
     * - Static assets (images, fonts, etc.)
     * - Public routes (/, /login, etc.)
     * - /api/widget (public widget endpoint) - excluded in middleware function above
     */
    '/dashboard/:path*',
    '/api/:path*', // We check for /api/widget inside middleware and skip it
  ],
};
