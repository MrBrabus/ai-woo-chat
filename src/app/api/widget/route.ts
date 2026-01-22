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
    const widgetScript = `
      (function() {
        'use strict';
        
        console.log('AI Woo Chat: Widget script loaded and starting execution...');
        console.log('AI Woo Chat: Step 1 - IIFE started');
        
        try {
          console.log('AI Woo Chat: Step 2 - Entering main try block');
        
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
          console.log('AI Woo Chat: Widget container already exists in DOM, skipping script execution');
          return;
        }
        
        const CONFIG = window.AIWooChatConfig || {};
        const SAAS_URL = CONFIG.saasUrl || '';
        const SITE_ID = CONFIG.siteId || '';
        
        if (!SAAS_URL || !SITE_ID) {
          return;
        }
        
        // Storage helper functions for localStorage
        const storagePrefix = 'ai_woo_chat_';
        const visitorIdKey = storagePrefix + 'visitor_id';
        const conversationIdKey = storagePrefix + 'conversation_id';
        const visitorIdExpiryKey = storagePrefix + 'visitor_id_expiry';
        const conversationIdExpiryKey = storagePrefix + 'conversation_id_expiry';
        
        // TTL: 90 days for visitor ID, 30 days for conversation ID
        const visitorIdTTL = 90 * 24 * 60 * 60 * 1000; // 90 days
        const conversationIdTTL = 30 * 24 * 60 * 60 * 1000; // 30 days
        
        const getStorageItem = function(key) {
          try {
            return localStorage.getItem(key);
          } catch (e) {
            try {
              return sessionStorage.getItem(key);
            } catch (e2) {
              return null;
            }
          }
        };
        
        const setStorageItem = function(key, value) {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            try {
              sessionStorage.setItem(key, value);
            } catch (e2) {
              console.warn('AI Woo Chat: Failed to save to storage:', key);
            }
          }
        };
        
        const isExpired = function(expiryKey) {
          try {
            const expiry = getStorageItem(expiryKey);
            if (!expiry) return true;
            return Date.now() > parseInt(expiry, 10);
          } catch {
            return true;
          }
        };
        
        const getStoredVisitorId = function() {
          if (isExpired(visitorIdExpiryKey)) {
            return null;
          }
          return getStorageItem(visitorIdKey);
        };
        
        const getStoredConversationId = function() {
          if (isExpired(conversationIdExpiryKey)) {
            return null;
          }
          return getStorageItem(conversationIdKey);
        };
        
        const saveSession = function(visitorId, conversationId) {
          const visitorExpiry = Date.now() + visitorIdTTL;
          const conversationExpiry = Date.now() + conversationIdTTL;
          setStorageItem(visitorIdKey, visitorId);
          setStorageItem(visitorIdExpiryKey, visitorExpiry.toString());
          setStorageItem(conversationIdKey, conversationId);
          setStorageItem(conversationIdExpiryKey, conversationExpiry.toString());
        };
        
        // Chat session state (visitor_id, conversation_id)
        let chatSession = {
          visitorId: getStoredVisitorId(),
          conversationId: getStoredConversationId(),
          isLoading: false
        };
        
        // Chat config from bootstrap
        let chatConfig = {
          title: 'AI Assistant',
          welcome_message: 'Hello! I am your AI assistant. How can I help you today?',
          input_placeholder: 'Type your message...',
          send_button_text: 'Send',
          avatar_url: null,
          primary_color: '#667eea',
          secondary_color: '#764ba2',
          use_gradient: true,
          bubble_position: 'bottom-right',
          delay_seconds: 0
        };
        
        // Track if bubble should be shown (for delayed appearance)
        let showBubble = false;
        
        const sendClientLog = async function(level, message, error, context) {
          try {
            await fetch(SAAS_URL + '/api/logs/client', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                level,
                message,
                error: error ? {
                  name: error.name || 'Error',
                  message: error.message || String(error),
                  stack: error.stack
                } : undefined,
                context: {
                  ...context,
                  site_id: SITE_ID,
                  visitor_id: chatSession.visitorId,
                  conversation_id: chatSession.conversationId,
                  url: window.location.href,
                }
              })
            });
          } catch (logError) {
            console.warn('Failed to send client log:', logError);
          }
        };
        
        // Bootstrap chat session on widget initialization
        const bootstrapChat = async function() {
          try {
            console.log('AI Woo Chat: Bootstrapping chat session...');
            console.log('AI Woo Chat: Stored visitor_id:', chatSession.visitorId);
            console.log('AI Woo Chat: Stored conversation_id:', chatSession.conversationId);
            
            // Load stored IDs from localStorage if available
            const storedVisitorId = getStoredVisitorId();
            const storedConversationId = getStoredConversationId();
            
            const response = await fetch(SAAS_URL + '/api/chat/bootstrap', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Origin': window.location.origin
              },
              body: JSON.stringify({
                site_id: SITE_ID,
                visitor_id: storedVisitorId || null,
                conversation_id: storedConversationId || null
              })
            });
            
            if (!response.ok) {
              console.error('AI Woo Chat: Bootstrap failed:', response.status, response.statusText);
              return;
            }
            
            const data = await response.json();
            chatSession.visitorId = data.visitor_id;
            chatSession.conversationId = data.conversation_id;
            
            // Save session to localStorage for persistence across page navigations
            saveSession(data.visitor_id, data.conversation_id);
            console.log('AI Woo Chat: Session saved to localStorage');
            
            if (data.chat_config) {
              chatConfig = {
                title: data.chat_config.title || 'AI Assistant',
                welcome_message: data.chat_config.welcome_message || 'Hello! I am your AI assistant. How can I help you today?',
                input_placeholder: data.chat_config.input_placeholder || 'Type your message...',
                send_button_text: data.chat_config.send_button_text || 'Send',
                avatar_url: data.chat_config.avatar_url || null,
                primary_color: data.chat_config.primary_color || '#667eea',
                secondary_color: data.chat_config.secondary_color || '#764ba2',
                use_gradient: data.chat_config.use_gradient !== false,
                bubble_position: data.chat_config.bubble_position || 'bottom-right',
                delay_seconds: data.chat_config.delay_seconds ?? 0
              };
            }
            console.log('AI Woo Chat: Chat session bootstrapped:', chatSession);
            console.log('AI Woo Chat: Chat config:', chatConfig);
            console.log('AI Woo Chat: Welcome back:', data.welcome_back || false);
            
            // Handle delayed appearance
            const delaySeconds = chatConfig.delay_seconds || 0;
            if (delaySeconds > 0) {
              setTimeout(function() {
                showBubble = true;
                const existingContainer = document.getElementById('ai-woo-chat-widget-container');
                if (existingContainer) {
                  existingContainer.style.display = 'block';
                  existingContainer.style.animation = 'bubbleAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
                }
              }, delaySeconds * 1000);
            } else {
              showBubble = true;
            }
            
            // Update widget UI with chat config if already rendered
            const existingHeaderTitle = document.getElementById('ai-woo-chat-header-title');
            const existingWelcomeMsg = document.getElementById('ai-woo-chat-welcome-msg');
            const existingInput = document.getElementById('ai-woo-chat-input');
            const existingSendBtn = document.getElementById('ai-woo-chat-send');
            const existingAvatar = document.getElementById('ai-woo-chat-avatar');
            
            if (existingHeaderTitle) {
              existingHeaderTitle.textContent = chatConfig.title;
            }
            if (existingWelcomeMsg) {
              existingWelcomeMsg.textContent = chatConfig.welcome_message;
            }
            if (existingInput) {
              existingInput.placeholder = chatConfig.input_placeholder;
            }
            if (existingSendBtn) {
              existingSendBtn.textContent = chatConfig.send_button_text;
            }
            if (chatConfig.avatar_url && existingAvatar) {
              existingAvatar.src = chatConfig.avatar_url;
              existingAvatar.style.display = 'block';
            } else if (existingAvatar) {
              existingAvatar.style.display = 'none';
            }
          } catch (error) {
            console.error('AI Woo Chat: Bootstrap error:', error);
            await sendClientLog('error', 'Bootstrap chat session failed', error, {
              action: 'bootstrap'
            });
          }
        };
        
        // Initialize widget immediately (no React dependencies needed for minimal version)
        const initWidget = () => {
          console.log('AI Woo Chat: initWidget called');
          console.log('AI Woo Chat: window.AIWooChatWidget:', window.AIWooChatWidget);
          
          // Check if widget is already rendered (check DOM, not flag)
          const existingWidget = document.getElementById('ai-woo-chat-widget-container');
          console.log('AI Woo Chat: existingWidget check:', existingWidget);
          if (existingWidget) {
            console.log('AI Woo Chat: Widget already rendered in DOM, skipping');
            return;
          }
          
          console.log('AI Woo Chat: Widget not found in DOM, proceeding with initialization');
          const container = document.getElementById('ai-woo-chat-widget');
          console.log('AI Woo Chat: Container element:', container);
          if (!container) {
            console.log('AI Woo Chat: Creating new container element');
            const newContainer = document.createElement('div');
            newContainer.id = 'ai-woo-chat-widget';
            document.body.appendChild(newContainer);
            initMinimalWidget(newContainer);
            return;
          }
          
          // For now, use minimal widget that works immediately
          // TODO: In production, load the full React widget bundle
          console.log('AI Woo Chat: Using existing container, calling initMinimalWidget');
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
            console.log('AI Woo Chat: Step 4 - Entering initMinimalWidget try block');
          
            // Create widget HTML using createElement to avoid template literal escaping issues
            console.log('AI Woo Chat: Step 5 - About to create widgetContainer element');
          const widgetContainer = document.createElement('div');
            console.log('AI Woo Chat: Step 6 - widgetContainer created:', widgetContainer);
          widgetContainer.id = 'ai-woo-chat-widget-container';
          
          // Set position based on config
          const position = chatConfig.bubble_position || 'bottom-right';
          const positionStyle = position === 'center-right'
            ? 'position:fixed;top:50%;right:24px;transform:translateY(-50%);z-index:9998;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;'
            : 'position:fixed;bottom:24px;right:24px;z-index:9998;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;';
          
          widgetContainer.style.cssText = positionStyle;
          if (chatConfig.delay_seconds > 0) {
            widgetContainer.style.display = 'none';
          }
          
          const chatWindow = document.createElement('div');
          chatWindow.id = 'ai-woo-chat-window';
          const windowPosition = position === 'center-right'
            ? 'top:50%;right:24px;transform:translateY(-50%);'
            : 'bottom:100px;right:24px;';
          chatWindow.style.cssText = 'display:none;position:fixed;width:400px;height:600px;max-width:calc(100vw - 48px);max-height:calc(100vh - 140px);' + windowPosition + 'background:white;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.15);flex-direction:column;z-index:9999;overflow:hidden;';
          
          // Add mobile responsive styles
          const mobileMediaQuery = '@media (max-width: 768px) { #ai-woo-chat-window { bottom: 0 !important; right: 0 !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; max-height: 100vh !important; border-radius: 0 !important; transform: none !important; } }';
          if (!document.getElementById('ai-woo-chat-mobile-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-woo-chat-mobile-styles';
            style.textContent = mobileMediaQuery;
            document.head.appendChild(style);
          }
          
          const header = document.createElement('div');
          const primaryColor = chatConfig.primary_color || '#667eea';
          const secondaryColor = chatConfig.secondary_color || '#764ba2';
          const useGradient = chatConfig.use_gradient !== false;
          const headerBg = useGradient
            ? 'background:linear-gradient(135deg, ' + primaryColor + ' 0%, ' + secondaryColor + ' 100%);'
            : 'background:' + primaryColor + ';';
          header.style.cssText = headerBg + 'color:white;padding:18px 20px;border-radius:20px 20px 0 0;display:flex;justify-content:space-between;align-items:center;position:relative;overflow:hidden;';
          
          const headerContent = document.createElement('div');
          headerContent.style.cssText = 'display:flex;align-items:center;gap:12px;';
          
          if (chatConfig.avatar_url) {
            const avatar = document.createElement('img');
            avatar.id = 'ai-woo-chat-avatar';
            avatar.src = chatConfig.avatar_url;
            avatar.style.cssText = 'width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid rgba(255,255,255,0.3);';
            headerContent.appendChild(avatar);
          } else {
            const avatar = document.createElement('img');
            avatar.id = 'ai-woo-chat-avatar';
            avatar.style.cssText = 'display:none;';
            headerContent.appendChild(avatar);
          }
          
          const headerTitle = document.createElement('h3');
          headerTitle.id = 'ai-woo-chat-header-title';
          headerTitle.style.cssText = 'margin:0;font-size:16px;font-weight:600;';
          headerTitle.textContent = chatConfig.title;
          headerContent.appendChild(headerTitle);
          
          header.appendChild(headerContent);
          
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
          messagesDiv.style.cssText = 'flex:1;padding:20px;overflow-y:auto;height:450px;background:linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%);scroll-behavior:smooth;';
          
          const welcomeMsg = document.createElement('div');
          welcomeMsg.style.cssText = 'background:white;padding:12px 16px;border-radius:8px;margin-bottom:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);';
          const welcomeP = document.createElement('p');
          welcomeP.id = 'ai-woo-chat-welcome-msg';
          welcomeP.style.cssText = 'margin:0;color:#495057;font-size:14px;line-height:1.5;';
          welcomeP.textContent = chatConfig.welcome_message;
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
          input.placeholder = chatConfig.input_placeholder;
          input.style.cssText = 'flex:1;padding:10px 14px;border:1px solid #dee2e6;border-radius:8px;box-sizing:border-box;font-size:14px;outline:none;transition:border-color 0.2s;';
          input.onfocus = function() { this.style.borderColor = '#667eea'; };
          input.onblur = function() { this.style.borderColor = '#dee2e6'; };
          
          const sendBtn = document.createElement('button');
          sendBtn.id = 'ai-woo-chat-send';
          const sendBtnBg = useGradient
            ? 'background:linear-gradient(135deg, ' + primaryColor + ' 0%, ' + secondaryColor + ' 100%);'
            : 'background:' + primaryColor + ';';
          sendBtn.style.cssText = sendBtnBg + 'color:white;border:none;padding:10px 20px;border-radius:20px;cursor:pointer;font-size:14px;font-weight:500;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:0 2px 8px rgba(0,0,0,0.15);';
          sendBtn.textContent = chatConfig.send_button_text;
          sendBtn.onmouseover = function() { this.style.transform = 'translateY(-2px) scale(1.05)'; this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'; };
          sendBtn.onmouseout = function() { this.style.transform = 'none'; this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; };
          
          inputWrapper.appendChild(input);
          inputWrapper.appendChild(sendBtn);
          inputContainer.appendChild(inputWrapper);
          chatWindow.appendChild(inputContainer);
          
          widgetContainer.appendChild(chatWindow);
          
          const toggleBtn = document.createElement('button');
          toggleBtn.id = 'ai-woo-chat-toggle';
          const bubbleBg = useGradient
            ? 'background:linear-gradient(135deg, ' + primaryColor + ' 0%, ' + secondaryColor + ' 100%);'
            : 'background:' + primaryColor + ';';
          const bubbleTransform = position === 'center-right' ? 'translateY(-50%)' : 'none';
          toggleBtn.style.cssText = 'width:64px;height:64px;border-radius:50%;' + bubbleBg + 'border:none;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1);display:flex;align-items:center;justify-content:center;color:white;transition:all 0.3s cubic-bezier(0.4, 0, 0.2, 1);overflow:visible;animation:bubbleAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);';
          if (position === 'center-right') {
            toggleBtn.style.top = '50%';
            toggleBtn.style.transform = 'translateY(-50%)';
          }
          toggleBtn.onmouseover = function() {
            const hoverTransform = position === 'center-right' ? 'translateY(calc(-50% - 4px)) scale(1.05)' : 'translateY(-4px) scale(1.05)';
            this.style.transform = hoverTransform;
            this.style.boxShadow = '0 12px 32px rgba(0,0,0,0.25), 0 6px 12px rgba(0,0,0,0.15)';
          };
          toggleBtn.onmouseout = function() {
            const normalTransform = position === 'center-right' ? 'translateY(-50%) scale(1)' : 'scale(1)';
            this.style.transform = normalTransform;
            this.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2), 0 4px 8px rgba(0,0,0,0.1)';
          };
          
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
          
          // Add CSS animations
          if (!document.getElementById('ai-woo-chat-animations')) {
            const style = document.createElement('style');
            style.id = 'ai-woo-chat-animations';
            style.textContent = '@keyframes bubbleAppear { 0% { opacity: 0; transform: scale(0) rotate(-180deg); } 60% { transform: scale(1.1) rotate(10deg); } 100% { opacity: 1; transform: scale(1) rotate(0deg); } } ' +
              '@keyframes windowSlideIn { 0% { opacity: 0; transform: translateY(20px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } } ' +
              '@keyframes windowSlideInCenter { 0% { opacity: 0; transform: translateY(calc(-50% + 20px)) scale(0.95); } 100% { opacity: 1; transform: translateY(-50%) scale(1); } } ' +
              '@keyframes windowSlideUpMobile { 0% { opacity: 0; transform: translateY(100%); } 100% { opacity: 1; transform: translateY(0); } }';
            document.head.appendChild(style);
          }
          
          // Add click handlers
          if (toggleBtn && chatWindow) {
            toggleBtn.addEventListener('click', function() {
              if (chatWindow.style.display === 'none' || !chatWindow.style.display) {
                chatWindow.style.display = 'flex';
                const animation = position === 'center-right' ? 'windowSlideInCenter' : 'windowSlideIn';
                chatWindow.style.animation = animation + ' 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
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
                const newlineCode = 10;
                const lines = buffer.split(String.fromCharCode(newlineCode));
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
              
              sendClientLog('error', 'Failed to send chat message', error, {
                action: 'send_message',
                message_length: originalMessage?.length || 0,
                response_status: error.message?.includes('status') ? error.message : undefined
              }).catch(function() {});
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
          // This will update the UI with chat config
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
        
        console.log('AI Woo Chat: Step 3 - About to close setTimeout');
        } catch (outerError) {
          console.error('AI Woo Chat: CRITICAL ERROR in widget script IIFE:', outerError);
          console.error('AI Woo Chat: Error message:', outerError.message);
          console.error('AI Woo Chat: Error stack:', outerError.stack);
          throw outerError;
        }
        
        console.log('AI Woo Chat: Widget script IIFE setup complete');
      })();
    `;

    // Get Origin header for CORS validation
    const origin = req.headers.get('origin');
    
    // Widget bundle allows cross-origin loading
    // API endpoints validate Origin properly
    const headers = new Headers({
      'Content-Type': 'application/javascript; charset=utf-8',
      // Reduced cache to allow updates - cache for 1 hour
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      ...corsHeaders,
      'X-Content-Type-Options': 'nosniff',
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
