/**
 * Widget bundle API endpoint
 * 
 * Serves the widget JavaScript bundle
 * This endpoint allows WordPress sites to load the widget
 * 
 * Note: In production, this should serve a pre-built bundle
 * For development, we'll use a simple loader that imports React from CDN
 */

import { NextRequest, NextResponse } from 'next/server';

// Handle OPTIONS preflight requests
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    // In production, this would serve a pre-built bundle from public/widget/widget.js
    // For now, we'll serve a script that dynamically loads React and the widget
    const widgetScript = `
      (function() {
        'use strict';
        
        if (window.AIWooChatWidget && window.AIWooChatWidget.initialized) {
          return;
        }
        
        const CONFIG = window.AIWooChatConfig || {};
        const SAAS_URL = CONFIG.saasUrl || '';
        const SITE_ID = CONFIG.siteId || '';
        
        if (!SAAS_URL || !SITE_ID) {
          console.warn('AI Woo Chat: Missing configuration');
          return;
        }
        
        // Load React and ReactDOM from CDN
        const loadScript = (src) => {
          return new Promise((resolve, reject) => {
            if (document.querySelector('script[src="' + src + '"]')) {
              resolve();
              return;
            }
            const script = document.createElement('script');
            script.src = src;
            script.crossOrigin = 'anonymous';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
        };
        
        // Initialize widget after React is loaded
        const initWidget = () => {
          const container = document.getElementById('ai-woo-chat-widget');
          if (!container) {
            console.error('AI Woo Chat: Container not found');
            return;
          }
          
          // For now, create a simple chat widget placeholder
          // In production, this would load the full React widget component
          console.log('AI Woo Chat: Widget initialized', {
            siteId: SITE_ID,
            saasUrl: SAAS_URL,
            container: container
          });
          
          // TODO: Load full React widget component here
          // This is a placeholder - the actual widget implementation will be added later
        };
        
        // Load React dependencies
        Promise.all([
          loadScript('https://unpkg.com/react@18/umd/react.production.min.js'),
          loadScript('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js'),
        ]).then(() => {
          // Wait a bit for React to be available globally
          setTimeout(initWidget, 100);
        }).catch((error) => {
          console.error('AI Woo Chat: Failed to load React dependencies:', error);
        });
      })();
    `;

    // Get Origin header for CORS validation
    const origin = req.headers.get('origin');
    
    // For widget bundle, we allow cross-origin loading but should validate against allowed_origins
    // For now, we'll allow all origins for the bundle (it's public JavaScript)
    // The actual API endpoints will validate Origin properly
    const headers = new Headers({
      'Content-Type': 'application/javascript; charset=utf-8',
      // Cache with versioning - in production, use versioned URLs
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Access-Control-Allow-Origin': '*', // Widget bundle is public, allow all origins
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
      // Note: Vary: Origin not needed when using '*'
    });

    return new NextResponse(widgetScript, { headers });
  } catch (error) {
    console.error('Widget bundle error:', error);
    return new NextResponse('// Widget bundle error', {
      status: 500,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
}
