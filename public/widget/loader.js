/**
 * AI Woo Chat Widget Loader
 * 
 * Vanilla JS loader script that injects the React widget into WordPress sites
 * This script is loaded by WordPress plugin and initializes the widget
 */

(function() {
  'use strict';

  // Configuration from WordPress plugin
  const CONFIG = window.AIWooChatConfig || {};
  const SAAS_URL = CONFIG.saasUrl || '';
  const SITE_ID = CONFIG.siteId || '';

  if (!SAAS_URL || !SITE_ID) {
    console.warn('AI Woo Chat: Missing configuration (saasUrl or siteId)');
    return;
  }

  // Prevent multiple initializations
  if (window.AIWooChatWidget) {
    return;
  }

  // Create widget container
  const widgetContainer = document.createElement('div');
  widgetContainer.id = 'ai-woo-chat-widget';
  document.body.appendChild(widgetContainer);

  // Load widget bundle from API endpoint
  const script = document.createElement('script');
  script.src = `${SAAS_URL}/api/widget`;
  script.async = true;
  script.onerror = function() {
    console.error('AI Woo Chat: Failed to load widget script');
  };

  document.head.appendChild(script);

  // Mark as initialized
  window.AIWooChatWidget = { initialized: true };
})();
