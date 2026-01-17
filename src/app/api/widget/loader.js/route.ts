/**
 * Widget Loader Endpoint
 * 
 * Serves the widget loader.js script
 * This is the entry point that WordPress plugin loads
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// Handle OPTIONS preflight requests
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    // Read the loader.js file from public folder
    const filePath = join(process.cwd(), 'public', 'widget', 'loader.js');
    let loaderScript: string;
    
    try {
      loaderScript = readFileSync(filePath, 'utf-8');
    } catch (fileError) {
      // If file doesn't exist, use inline script
      throw new Error('File not found');
    }

    // Get Origin header for CORS
    const origin = req.headers.get('origin');
    
    // Set proper headers for JavaScript file with full CORS support
    const headers = new Headers({
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      // Allow all origins for widget loader (it's public JavaScript)
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });

    return new NextResponse(loaderScript, { headers });
  } catch (error) {
    console.error('Widget loader error:', error);
    
    // Fallback: return inline loader script
    const fallbackScript = `
      (function() {
        'use strict';
        const CONFIG = window.AIWooChatConfig || {};
        const SAAS_URL = CONFIG.saasUrl || '';
        const SITE_ID = CONFIG.siteId || '';
        if (!SAAS_URL || !SITE_ID) {
          console.warn('AI Woo Chat: Missing configuration');
          return;
        }
        const widgetContainer = document.createElement('div');
        widgetContainer.id = 'ai-woo-chat-widget';
        document.body.appendChild(widgetContainer);
        const script = document.createElement('script');
        script.src = SAAS_URL + '/api/widget';
        script.async = true;
        script.onerror = function() {
          console.error('AI Woo Chat: Failed to load widget script');
        };
        document.head.appendChild(script);
        window.AIWooChatWidget = { initialized: true };
      })();
    `;
    
    return new NextResponse(fallbackScript, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
