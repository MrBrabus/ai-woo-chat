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
        
        console.log('AI Woo Chat: Widget script loaded and starting execution...');
        
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
        
        // Chat session state (visitor_id, conversation_id)
        let chatSession = {
          visitorId: null,
          conversationId: null,
          isLoading: false
        };
        
        // Bootstrap chat session on widget initialization
        const bootstrapChat = async function() {
          try {
            console.log('AI Woo Chat: Bootstrapping chat session...');
            const response = await fetch(SAAS_URL + '/api/chat/bootstrap', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Origin': window.location.origin
              },
              body: JSON.stringify({
                site_id: SITE_ID
              })
            });
            
            if (!response.ok) {
              console.error('AI Woo Chat: Bootstrap failed:', response.status, response.statusText);
              return;
            }
            
            const data = await response.json();
            chatSession.visitorId = data.visitor_id;
            chatSession.conversationId = data.conversation_id;
            console.log('AI Woo Chat: Chat session bootstrapped:', chatSession);
          } catch (error) {
            console.error('AI Woo Chat: Bootstrap error:', error);
          }
        };
        
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
          console.log('AI Woo Chat: Container type:', typeof container);
          console.log('AI Woo Chat: Container exists:', !!container);
          if (!container) {
            console.error('AI Woo Chat: initMinimalWidget - container is null');
            return;
          }
          
          try {
          
          // Create widget HTML using createElement to avoid template literal escaping issues
          const widgetContainer = document.createElement('div');
          widgetContainer.id = 'ai-woo-chat-widget-container';
          widgetContainer.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9998;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;';
          
          const chatWindow = document.createElement('div');
          chatWindow.id = 'ai-woo-chat-window';
          chatWindow.style.cssText = 'display:none;width:380px;height:600px;max-width:calc(100vw - 48px);max-height:calc(100vh - 96px);background:white;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.12);flex-direction:column;margin-bottom:12px;';
          
          const header = document.createElement('div');
          header.style.cssText = 'background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;padding:16px 20px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;';
          
          const headerTitle = document.createElement('h3');
          headerTitle.style.cssText = 'margin:0;font-size:16px;font-weight:600;';
          headerTitle.textContent = 'AI Assistant';
          header.appendChild(headerTitle);
          
          const closeBtn = document.createElement('button');
          closeBtn.id = 'ai-woo-chat-close';
          closeBtn.style.cssText = 'background:none;border:none;color:white;font-size:24px;cursor:pointer;padding:0;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:background 0.2s;';
          closeBtn.textContent = '×';
          closeBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.2)'; };
          closeBtn.onmouseout = function() { this.style.background = 'none'; };
          header.appendChild(closeBtn);
          
          chatWindow.appendChild(header);
          
          const messagesDiv = document.createElement('div');
          messagesDiv.id = 'ai-woo-chat-messages';
          messagesDiv.style.cssText = 'flex:1;padding:20px;overflow-y:auto;height:450px;background:#f8f9fa;';
          
          const welcomeMsg = document.createElement('div');
          welcomeMsg.style.cssText = 'background:white;padding:12px 16px;border-radius:8px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);';
          const welcomeP = document.createElement('p');
          welcomeP.style.cssText = 'margin:0;color:#495057;font-size:14px;line-height:1.5;';
          welcomeP.textContent = 'Hello! I\\'m your AI assistant. How can I help you today?';
          welcomeMsg.appendChild(welcomeP);
          messagesDiv.appendChild(welcomeMsg);
          
          chatWindow.appendChild(messagesDiv);
          
          const inputContainer = document.createElement('div');
          inputContainer.style.cssText = 'padding:16px;border-top:1px solid #e9ecef;background:white;border-radius:0 0 12px 12px;';
          
          const inputWrapper = document.createElement('div');
          inputWrapper.style.cssText = 'display:flex;gap:8px;';
          
          const input = document.createElement('input');
          input.type = 'text';
          input.id = 'ai-woo-chat-input';
          input.placeholder = 'Type your message...';
          input.style.cssText = 'flex:1;padding:10px 14px;border:1px solid #dee2e6;border-radius:8px;box-sizing:border-box;font-size:14px;outline:none;transition:border-color 0.2s;';
          input.onfocus = function() { this.style.borderColor = '#667eea'; };
          input.onblur = function() { this.style.borderColor = '#dee2e6'; };
          
          const sendBtn = document.createElement('button');
          sendBtn.id = 'ai-woo-chat-send';
          sendBtn.style.cssText = 'background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;font-size:14px;font-weight:500;transition:transform 0.2s,box-shadow 0.2s;';
          sendBtn.textContent = 'Send';
          sendBtn.onmouseover = function() { this.style.transform = 'translateY(-1px)'; this.style.boxShadow = '0 4px 12px rgba(102,126,234,0.4)'; };
          sendBtn.onmouseout = function() { this.style.transform = 'none'; this.style.boxShadow = 'none'; };
          
          inputWrapper.appendChild(input);
          inputWrapper.appendChild(sendBtn);
          inputContainer.appendChild(inputWrapper);
          chatWindow.appendChild(inputContainer);
          
          widgetContainer.appendChild(chatWindow);
          
          const toggleBtn = document.createElement('button');
          toggleBtn.id = 'ai-woo-chat-toggle';
          toggleBtn.style.cssText = 'width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);border:none;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;color:white;transition:transform 0.2s ease,box-shadow 0.2s ease;';
          toggleBtn.onmouseover = function() { this.style.transform = 'scale(1.1)'; this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.2)'; };
          toggleBtn.onmouseout = function() { this.style.transform = 'scale(1)'; this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'; };
          
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', '24');
          svg.setAttribute('height', '24');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('fill', 'none');
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', 'M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z');
          path.setAttribute('fill', 'currentColor');
          svg.appendChild(path);
          toggleBtn.appendChild(svg);
          
          widgetContainer.appendChild(toggleBtn);
          container.appendChild(widgetContainer);
          
          // Add click handlers
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
          
          const sendMessage = async function() {
            if (!input || !messagesDiv) return;
            const message = input.value.trim();
            if (!message) return;
            
            // Prevent multiple simultaneous requests
            if (chatSession.isLoading) {
              console.log('AI Woo Chat: Message already being processed, ignoring duplicate');
              return;
            }
            
            // Bootstrap session if not already done
            if (!chatSession.visitorId || !chatSession.conversationId) {
              console.log('AI Woo Chat: Bootstrapping session before sending message...');
              await bootstrapChat();
              if (!chatSession.visitorId || !chatSession.conversationId) {
                console.error('AI Woo Chat: Failed to bootstrap session, cannot send message');
                const errorMsg = document.createElement('div');
                errorMsg.style.cssText = 'background:#fee;color:#c33;padding:12px 16px;border-radius:8px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);';
                errorMsg.innerHTML = '<p style="margin:0;font-size:14px;line-height:1.5;">Failed to initialize chat session. Please refresh the page.</p>';
                messagesDiv.appendChild(errorMsg);
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
                return;
              }
            }
            
            // Add user message to UI
            const userMsg = document.createElement('div');
            userMsg.style.cssText = 'background:#667eea;color:white;padding:12px 16px;border-radius:8px;margin-bottom:12px;margin-left:40px;box-shadow:0 1px 3px rgba(0,0,0,0.1);';
            const msgP = document.createElement('p');
            msgP.style.cssText = 'margin:0;font-size:14px;line-height:1.5;';
            msgP.textContent = message;
            userMsg.appendChild(msgP);
            messagesDiv.appendChild(userMsg);
            
            // Clear input and disable while processing
            const originalMessage = message;
            input.value = '';
            input.disabled = true;
            sendBtn.disabled = true;
            chatSession.isLoading = true;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            
            // Create assistant message container (will be updated with streaming content)
            const assistantMsg = document.createElement('div');
            assistantMsg.style.cssText = 'background:white;padding:12px 16px;border-radius:8px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);';
            const assistantP = document.createElement('p');
            assistantP.style.cssText = 'margin:0;color:#495057;font-size:14px;line-height:1.5;';
            assistantP.textContent = '...';
            assistantMsg.appendChild(assistantP);
            messagesDiv.appendChild(assistantMsg);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
            
            try {
              console.log('AI Woo Chat: Sending message to API...', { 
                visitorId: chatSession.visitorId, 
                conversationId: chatSession.conversationId 
              });
              
              // Send message with SSE streaming
              const response = await fetch(SAAS_URL + '/api/chat/message', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'text/event-stream',
                  'Origin': window.location.origin
                },
                body: JSON.stringify({
                  site_id: SITE_ID,
                  visitor_id: chatSession.visitorId,
                  conversation_id: chatSession.conversationId,
                  message: originalMessage
                })
              });
              
              if (!response.ok) {
                throw new Error('API request failed: ' + response.status + ' ' + response.statusText);
              }
              
              const reader = response.body.getReader();
              const decoder = new TextDecoder();
              let buffer = '';
              let fullResponse = '';
              
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (!dataStr || dataStr === '[DONE]') continue;
                    
                    try {
                      const data = JSON.parse(dataStr);
                      
                      if (data.type === 'chunk' && data.content) {
                        fullResponse += data.content;
                        assistantP.textContent = fullResponse;
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                      } else if (data.type === 'product') {
                        // TODO: Handle product recommendations
                        console.log('AI Woo Chat: Product recommendation:', data);
                      } else if (data.type === 'done') {
                        console.log('AI Woo Chat: Message stream complete');
                      }
                    } catch (e) {
                      console.warn('AI Woo Chat: Failed to parse SSE data:', dataStr, e);
                    }
                  }
                }
              }
              
              // Final update
              if (fullResponse) {
                assistantP.textContent = fullResponse;
              } else {
                assistantP.textContent = 'Sorry, I could not process your message. Please try again.';
              }
              
            } catch (error) {
              console.error('AI Woo Chat: Error sending message:', error);
              assistantP.textContent = 'Sorry, an error occurred. Please try again.';
              assistantMsg.style.borderLeft = '3px solid #f44336';
            } finally {
              // Re-enable input and button
              input.disabled = false;
              sendBtn.disabled = false;
              chatSession.isLoading = false;
              messagesDiv.scrollTop = messagesDiv.scrollHeight;
              if (input) input.focus();
            }
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
          console.log('AI Woo Chat: initMinimalWidget completed successfully');
          
          // Bootstrap chat session after widget is initialized
          console.log('AI Woo Chat: About to call bootstrapChat, function exists:', typeof bootstrapChat);
          if (typeof bootstrapChat === 'function') {
            bootstrapChat().catch(function(error) {
              console.error('AI Woo Chat: Bootstrap failed in initMinimalWidget:', error);
            });
          } else {
            console.error('AI Woo Chat: bootstrapChat is not a function!', typeof bootstrapChat);
          }
          
          } catch (error) {
            console.error('AI Woo Chat: Error in initMinimalWidget:', error);
            console.error('AI Woo Chat: Error stack:', error.stack);
            throw error;
          }
        };
        
        // Initialize widget when DOM is ready
        // Use setTimeout to ensure this runs after WordPress inline loader
        setTimeout(function() {
          try {
            console.log('AI Woo Chat: setTimeout callback called, document.readyState:', document.readyState);
            if (document.readyState === 'loading') {
              console.log('AI Woo Chat: Document still loading, waiting for DOMContentLoaded');
              document.addEventListener('DOMContentLoaded', function() {
                console.log('AI Woo Chat: DOMContentLoaded, calling initWidget');
                try {
                  initWidget();
                } catch (e) {
                  console.error('AI Woo Chat: Error in initWidget (DOMContentLoaded):', e);
                  console.error('AI Woo Chat: Error stack:', e.stack);
                }
              });
            } else {
              // DOM is already ready
              console.log('AI Woo Chat: DOM ready, calling initWidget immediately');
              try {
                initWidget();
              } catch (e) {
                console.error('AI Woo Chat: Error in initWidget (immediate):', e);
                console.error('AI Woo Chat: Error stack:', e.stack);
              }
            }
          } catch (e) {
            console.error('AI Woo Chat: Error in setTimeout callback:', e);
            console.error('AI Woo Chat: Error stack:', e.stack);
          }
        }, 100);
        
        console.log('AI Woo Chat: Widget script IIFE setup complete');
      })();
    `;

    // Get Origin header for CORS validation
    const origin = req.headers.get('origin');
    
    // For widget bundle, we allow cross-origin loading but should validate against allowed_origins
    // For now, we'll allow all origins for the bundle (it's public JavaScript)
    // The actual API endpoints will validate Origin properly
    const headers = new Headers({
      'Content-Type': 'application/javascript; charset=utf-8',
      // Reduced cache to allow updates - cache for 1 hour
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
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
