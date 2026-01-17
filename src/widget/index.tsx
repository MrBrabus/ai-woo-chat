/**
 * Widget entry point
 * 
 * This is the main entry point for the widget bundle
 * It initializes the React widget and exposes it globally
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from './ChatWidget';

interface WidgetConfig {
  saasUrl: string;
  siteId: string;
  containerId: string;
}

// Global widget initialization function
(window as any).AIWooChatWidget = {
  init: function(config: WidgetConfig) {
    const container = document.getElementById(config.containerId);
    if (!container) {
      console.error('AI Woo Chat: Container not found:', config.containerId);
      return;
    }

    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <ChatWidget
          config={{
            saasUrl: config.saasUrl,
            siteId: config.siteId,
          }}
        />
      </React.StrictMode>
    );
  },
};
