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
  // Ensure CORS headers are always set, even for errors
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  };

  try {
    // In production, this would serve a pre-built bundle from public/widget/widget.js
    // For now, we'll serve a script that dynamically loads React and the widget
    const widgetScript = `
      (function() {
        'use strict';
        
        // Suppress React errors if React is not available (we don't use React)
        const originalError = console.error;
        console.error = function(...args) {
          const message = args[0]?.toString() || '';
          if (message.includes('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED') || 
              message.includes('React') || 
              message.includes('zb is undefined')) {
            // Ignore React-related errors (not our code)
            return;
          }
          originalError.apply(console, args);
        };
        
        // Check if widget container already exists and has content
        const existingContainer = document.getElementById('ai-woo-chat-widget-container');
        if (existingContainer) {
          // Widget already rendered
          return;
        }
        
        const CONFIG = window.AIWooChatConfig || {};
        const SAAS_URL = CONFIG.saasUrl || '';
        const SITE_ID = CONFIG.siteId || '';
        
        if (!SAAS_URL || !SITE_ID) {
          return;
        }
        
        // Initialize widget immediately (no React dependencies needed for minimal version)
        const initWidget = () => {
          console.log('AI Woo Chat: initWidget called');
          const container = document.getElementById('ai-woo-chat-widget');
          if (!container) {
            // If container doesn't exist, create it
            const newContainer = document.createElement('div');
            newContainer.id = 'ai-woo-chat-widget';
            document.body.appendChild(newContainer);
            initMinimalWidget(newContainer);
            return;
          }
          
          // Check if widget is already rendered in container
          const existingWidget = container.querySelector('#ai-woo-chat-widget-container');
          if (existingWidget) {
            return;
          }
          
          // For now, use minimal widget that works immediately
          // TODO: In production, load the full React widget bundle
          initMinimalWidget(container);
        };
        
        // Minimal widget fallback (works without external dependencies)
        const initMinimalWidget = (container) => {
          console.log('AI Woo Chat: initMinimalWidget called, container:', container);
          if (!container) {
            console.error('AI Woo Chat: initMinimalWidget - container is null');
            return;
          }
          
          // Load the actual widget bundle from Next.js build
          // For now, we'll create a minimal working widget
          const widgetHTML = \`
            <div id="ai-woo-chat-widget-container" style="position:fixed;bottom:24px;right:24px;z-index:9998;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
              <div id="ai-woo-chat-window" style="display:none;width:380px;height:600px;max-width:calc(100vw - 48px);max-height:calc(100vh - 96px);background:white;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.12);flex-direction:column;margin-bottom:12px;">
                <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:16px 20px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;">
                  <h3 style="margin:0;font-size:16px;font-weight:600;">AI Assistant</h3>
                  <button id="ai-woo-chat-close" style="background:none;border:none;color:white;font-size:24px;cursor:pointer;padding:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='none'">×</button>
                </div>
                <div id="ai-woo-chat-messages" style="flex:1;padding:20px;overflow-y:auto;height:450px;background:#f8f9fa;">
                  <div style="background:white;padding:12px 16px;border-radius:8px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                    <p style="margin:0;color:#495057;font-size:14px;line-height:1.5;">Hello! I'm your AI assistant. How can I help you today?</p>
                  </div>
                </div>
                <div style="padding:16px;border-top:1px solid #e9ecef;background:white;border-radius:0 0 12px 12px;">
                  <div style="display:flex;gap:8px;">
                    <input type="text" id="ai-woo-chat-input" placeholder="Type your message..." style="flex:1;padding:10px 14px;border:1px solid #dee2e6;border-radius:8px;box-sizing:border-box;font-size:14px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#667eea'" onblur="this.style.borderColor='#dee2e6'">
                    <button id="ai-woo-chat-send" style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;transition:transform 0.2s,box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(102,126,234,0.4)'" onmouseout="this.style.transform='none';this.style.boxShadow='none'">Send</button>
                  </div>
                </div>
              </div>
              <button id="ai-woo-chat-toggle" style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;color:white;transition:transform 0.2s ease,box-shadow 0.2s ease;" onmouseover="this.style.transform='scale(1.1)';this.style.boxShadow='0 6px 16px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='scale(1)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="currentColor"/>
                </svg>
              </button>
            </div>
          \`;
          
          // Set innerHTML directly
          console.log('AI Woo Chat: Setting innerHTML, widgetHTML length:', widgetHTML.length);
          container.innerHTML = widgetHTML;
          console.log('AI Woo Chat: innerHTML set, container now has:', container.innerHTML.substring(0, 100));
          
          // Add click handlers
          const toggleBtn = document.getElementById('ai-woo-chat-toggle');
          const closeBtn = document.getElementById('ai-woo-chat-close');
          const chatWindow = document.getElementById('ai-woo-chat-window');
          const sendBtn = document.getElementById('ai-woo-chat-send');
          const input = document.getElementById('ai-woo-chat-input');
          const messagesDiv = document.getElementById('ai-woo-chat-messages');
          
          if (toggleBtn && chatWindow) {
            toggleBtn.addEventListener('click', function() {
              if (chatWindow.style.display === 'none' || !chatWindow.style.display) {
                chatWindow.style.display = 'flex';
                toggleBtn.style.display = 'none';
                if (input) input.focus();
              } else {
                chatWindow.style.display = 'none';
                toggleBtn.style.display = 'block';
              }
            });
          }
          
          if (closeBtn && chatWindow && toggleBtn) {
            closeBtn.addEventListener('click', function() {
              chatWindow.style.display = 'none';
              toggleBtn.style.display = 'block';
            });
          }
          
          const sendMessage = function() {
            if (!input || !messagesDiv) return;
            const message = input.value.trim();
            if (!message) return;
            
            // Add user message
            const userMsg = document.createElement('div');
            userMsg.style.cssText = 'background:#667eea;color:white;padding:12px 16px;border-radius:8px;margin-bottom:12px;margin-left:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);';
            const msgP = document.createElement('p');
            msgP.style.cssText = 'margin:0;font-size:14px;line-height:1.5;';
            msgP.textContent = message;
            userMsg.appendChild(msgP);
            messagesDiv.appendChild(userMsg);
            
            input.value = '';
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            
            // Note: This is a minimal fallback - full functionality requires the React widget
            setTimeout(function() {
              const assistantMsg = document.createElement('div');
              assistantMsg.style.cssText = 'background:white;padding:12px 16px;border-radius:8px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);';
              assistantMsg.innerHTML = '<p style="margin:0;color:#495057;font-size:14px;line-height:1.5;">I\'m a minimal fallback widget. The full widget is still loading. Please refresh the page to try again.</p>';
              messagesDiv.appendChild(assistantMsg);
              messagesDiv.scrollTop = messagesDiv.scrollHeight;
            }, 500);
          };
          
          if (sendBtn) {
            sendBtn.addEventListener('click', sendMessage);
          }
          
          if (input) {
            input.addEventListener('keypress', function(e) {
              if (e.key === 'Enter') {
                sendMessage();
              }
            });
          }
          
          window.AIWooChatWidget = { initialized: true, fallback: true };
        };
        
        // Initialize widget when DOM is ready
        // Use setTimeout to ensure this runs after WordPress inline loader
        setTimeout(function() {
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
              console.log('AI Woo Chat: DOMContentLoaded, calling initWidget');
              initWidget();
            });
          } else {
            // DOM is already ready
            console.log('AI Woo Chat: DOM ready, calling initWidget immediately');
            initWidget();
          }
        }, 100);
      })();
    `;

    // Get Origin header for CORS validation
    const origin = req.headers.get('origin');
    
    // For widget bundle, we allow cross-origin loading but should validate against allowed_origins
    // For now, we'll allow all origins for the bundle (it's public JavaScript)
    // The actual API endpoints will validate Origin properly
    const headers = new Headers({
      'Content-Type': 'application/javascript; charset=utf-8',
      // Aggressive caching to reduce server load - cache for 24 hours
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      ...corsHeaders,
      'X-Content-Type-Options': 'nosniff',
      // Note: Vary: Origin not needed when using '*'
    });

    return new NextResponse(widgetScript, { headers });
  } catch (error) {
    // Always return CORS headers, even for errors
    return new NextResponse(
      `// Widget bundle error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      {
        status: 200, // Return 200 with error comment so CORS headers work
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          ...corsHeaders,
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  }
}
