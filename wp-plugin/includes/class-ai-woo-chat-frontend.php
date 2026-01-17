<?php
/**
 * Frontend widget loader class
 *
 * Handles injection of external SaaS script for chat widget.
 *
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI_Woo_Chat_Frontend class
 */
class AI_Woo_Chat_Frontend {
	
	/**
	 * Single instance
	 *
	 * @var AI_Woo_Chat_Frontend
	 */
	private static $instance = null;
	
	/**
	 * Get singleton instance
	 *
	 * @return AI_Woo_Chat_Frontend
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}
	
	/**
	 * Constructor
	 */
	private function __construct() {
		$this->init();
	}
	
	/**
	 * Initialize frontend
	 */
	private function init() {
		// Only load if activated
		$options = AI_Woo_Chat_Options::get_instance();
		if ( ! $options->is_activated() ) {
			return;
		}
		
		// Disable enqueue method - use only inject method to avoid ORB issues
		// add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_widget_script' ) );
		
		// Inject script in footer using fetch API to bypass ORB
		add_action( 'wp_footer', array( $this, 'inject_widget_script' ) );
	}
	
	/**
	 * Enqueue widget script
	 */
	public function enqueue_widget_script() {
		$options = AI_Woo_Chat_Options::get_instance();
		$saas_url = rtrim( $options->get_saas_url(), '/' );
		$site_id = $options->get_site_id();
		
		if ( empty( $saas_url ) || empty( $site_id ) ) {
			return;
		}
		
		// Build widget loader script URL
		// Use API endpoint to ensure proper MIME type
		$loader_url = $saas_url . '/api/widget/loader.js';
		
		// Enqueue external script
		wp_enqueue_script(
			'ai-woo-chat-widget-loader',
			$loader_url,
			array(),
			null, // Version not needed for external script
			true  // Load in footer
		);
		
		// Pass configuration to widget
		wp_localize_script(
			'ai-woo-chat-widget-loader',
			'AIWooChatConfig',
			array(
				'siteId'  => $site_id,
				'saasUrl' => $saas_url,
			)
		);
	}
	
	/**
	 * Inject widget script directly in footer
	 * Alternative method if enqueue doesn't work for external scripts
	 */
	public function inject_widget_script() {
		$options = AI_Woo_Chat_Options::get_instance();
		$saas_url = rtrim( $options->get_saas_url(), '/' );
		$site_id = $options->get_site_id();
		
		if ( empty( $saas_url ) || empty( $site_id ) ) {
			return;
		}
		
		// Build widget loader script URL
		// Use API endpoint to ensure proper MIME type
		$loader_url = $saas_url . '/api/widget/loader.js';
		
		?>
		<!-- AI Woo Chat Widget -->
		<script>
			window.AIWooChatConfig = {
				siteId: '<?php echo esc_js( $site_id ); ?>',
				saasUrl: '<?php echo esc_js( $saas_url ); ?>'
			};
		</script>
		<script>
			// Inline widget loader to bypass ORB issues
			(function() {
				'use strict';
				
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
				
				// Function to load widget with retry logic
				const loadWidget = (retryCount = 0) => {
					const maxRetries = 3;
					const retryDelay = 2000; // 2 seconds
					
					fetch(SAAS_URL + '/api/widget', {
						method: 'GET',
						mode: 'cors',
						credentials: 'omit',
						cache: 'no-cache',
						headers: {
							'Accept': 'application/javascript, text/javascript, */*'
						}
					})
					.then(response => {
						if (!response.ok) {
							throw new Error('Failed to load widget: ' + response.status);
						}
						// Check content type
						const contentType = response.headers.get('content-type') || '';
						if (!contentType.includes('javascript') && !contentType.includes('text/plain')) {
							console.warn('AI Woo Chat: Unexpected content type:', contentType);
						}
						return response.text();
					})
					.then(scriptText => {
						// Check if response is HTML instead of JavaScript
						if (scriptText.trim().startsWith('<!DOCTYPE') || scriptText.trim().startsWith('<html')) {
							if (retryCount < maxRetries) {
								console.log('AI Woo Chat: Received HTML instead of JavaScript, retrying in ' + (retryDelay/1000) + 's... (attempt ' + (retryCount + 1) + '/' + maxRetries + ')');
								setTimeout(() => loadWidget(retryCount + 1), retryDelay);
								return;
							}
							throw new Error('Received HTML instead of JavaScript after ' + maxRetries + ' retries');
						}
						
						// Check if response is valid JavaScript
						if (!scriptText.trim() || scriptText.trim().startsWith('//')) {
							console.warn('AI Woo Chat: Empty or comment-only response');
						}
						
						// Execute the widget script
						const script = document.createElement('script');
						script.textContent = scriptText;
						document.head.appendChild(script);
						window.AIWooChatWidget = { initialized: true };
						console.log('AI Woo Chat: Widget loaded successfully');
					})
					.catch(error => {
						if (retryCount < maxRetries) {
							console.log('AI Woo Chat: Error loading widget, retrying in ' + (retryDelay/1000) + 's... (attempt ' + (retryCount + 1) + '/' + maxRetries + ')');
							setTimeout(() => loadWidget(retryCount + 1), retryDelay);
						} else {
							console.error('AI Woo Chat: Failed to load widget after ' + maxRetries + ' attempts:', error);
							// Initialize minimal fallback widget
							initMinimalWidget();
						}
					});
				};
				
				// Minimal widget fallback (works without external scripts)
				const initMinimalWidget = () => {
					console.log('AI Woo Chat: Initializing minimal widget fallback...');
					const container = document.getElementById('ai-woo-chat-widget');
					if (!container) {
						console.error('AI Woo Chat: Container not found');
						return;
					}
					
					// Create a simple chat widget UI
					const widgetHTML = `
						<div id="ai-woo-chat-widget-container" style="position:fixed;bottom:20px;right:20px;z-index:9999;font-family:Arial,sans-serif;">
							<div id="ai-woo-chat-window" style="display:none;width:350px;height:500px;background:white;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3);flex-direction:column;margin-bottom:10px;">
								<div style="background:#0073aa;color:white;padding:15px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center;">
									<h3 style="margin:0;font-size:16px;">AI Chat Assistant</h3>
									<button id="ai-woo-chat-close" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;padding:0;width:24px;height:24px;">×</button>
								</div>
								<div id="ai-woo-chat-messages" style="flex:1;padding:15px;overflow-y:auto;height:350px;background:#f5f5f5;">
									<div style="background:white;padding:10px;border-radius:8px;margin-bottom:10px;">
										<p style="margin:0;color:#666;">Hello! I'm your AI assistant. The full widget is still loading. Please refresh the page to try again.</p>
									</div>
								</div>
								<div style="padding:15px;border-top:1px solid #ddd;background:white;border-radius:0 0 10px 10px;">
									<input type="text" id="ai-woo-chat-input" placeholder="Type your message..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:5px;box-sizing:border-box;" disabled>
									<p style="margin:5px 0 0 0;font-size:12px;color:#999;">Full widget loading... Please refresh page.</p>
								</div>
							</div>
							<button id="ai-woo-chat-toggle" style="background:#0073aa;color:white;border:none;padding:15px 20px;border-radius:50px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);font-size:16px;width:60px;height:60px;">💬</button>
						</div>
					`;
					
					container.innerHTML = widgetHTML;
					
					// Add click handlers
					const toggleBtn = document.getElementById('ai-woo-chat-toggle');
					const closeBtn = document.getElementById('ai-woo-chat-close');
					const chatWindow = document.getElementById('ai-woo-chat-window');
					
					toggleBtn.addEventListener('click', function() {
						if (chatWindow.style.display === 'none') {
							chatWindow.style.display = 'flex';
							toggleBtn.style.display = 'none';
						} else {
							chatWindow.style.display = 'none';
							toggleBtn.style.display = 'block';
						}
					});
					
					closeBtn.addEventListener('click', function() {
						chatWindow.style.display = 'none';
						toggleBtn.style.display = 'block';
					});
					
					window.AIWooChatWidget = { initialized: true, fallback: true };
					console.log('AI Woo Chat: Minimal widget initialized (fallback mode)');
				};
				
				// Start loading widget
				loadWidget();
			})();
		</script>
		<!-- End AI Woo Chat Widget -->
		<?php
	}
}
