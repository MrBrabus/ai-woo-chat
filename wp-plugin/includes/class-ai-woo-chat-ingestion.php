<?php
/**
 * Ingestion webhook class
 *
 * Handles sending webhook events to SaaS platform when content changes
 * (products, pages, policies created/updated/deleted).
 *
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI_Woo_Chat_Ingestion class
 */
class AI_Woo_Chat_Ingestion {
	
	/**
	 * Single instance
	 *
	 * @var AI_Woo_Chat_Ingestion
	 */
	private static $instance = null;
	
	/**
	 * Get singleton instance
	 *
	 * @return AI_Woo_Chat_Ingestion
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
	 * Initialize ingestion hooks
	 */
	private function init() {
		$options = AI_Woo_Chat_Options::get_instance();
		
		// Only register hooks if plugin is activated
		if ( ! $options->is_activated() ) {
			return;
		}
		
		// Wait for WooCommerce to be fully loaded before registering WooCommerce hooks
		// This prevents errors when WooCommerce is not yet initialized
		if ( class_exists( 'WooCommerce' ) && function_exists( 'wc_get_product' ) ) {
			// WooCommerce is already loaded, register hooks immediately
			$this->register_woocommerce_hooks();
		} else {
			// WooCommerce not loaded yet, wait for it
			add_action( 'woocommerce_loaded', array( $this, 'register_woocommerce_hooks' ) );
		}
		
		// WordPress post/page hooks (can be registered immediately)
		// Use priority 999 to run last and avoid conflicts
		// Handler functions will skip execution during admin page loads
		add_action( 'save_post', array( $this, 'handle_post_saved' ), 999, 3 );
		add_action( 'before_delete_post', array( $this, 'handle_post_deleted' ), 999, 1 );
	}
	
	/**
	 * Register WooCommerce-specific hooks
	 * Called when WooCommerce is loaded
	 */
	public function register_woocommerce_hooks() {
		// Double-check WooCommerce is available
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_product' ) ) {
			return;
		}
		
		// WooCommerce product hooks
		add_action( 'woocommerce_new_product', array( $this, 'handle_product_updated' ), 10, 1 );
		add_action( 'woocommerce_update_product', array( $this, 'handle_product_updated' ), 10, 1 );
		add_action( 'woocommerce_delete_product', array( $this, 'handle_product_deleted' ), 10, 1 );
		
		// WooCommerce product variation hooks (treat as product update)
		add_action( 'woocommerce_save_product_variation', array( $this, 'handle_product_variation_saved' ), 10, 2 );
	}
	
	/**
	 * Handle product created/updated
	 *
	 * @param int $product_id Product ID
	 */
	public function handle_product_updated( $product_id ) {
		// CRITICAL: Skip during AJAX requests (prevents interference with admin-ajax.php)
		// This is the most important check - admin-ajax.php uses AJAX
		if ( wp_doing_ajax() ) {
			return;
		}
		
		// Skip during cron jobs
		if ( wp_doing_cron() ) {
			return;
		}
		
		// Skip during REST API requests (WordPress REST API)
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return;
		}
		
		// CRITICAL: Skip if we're in admin area and this hook was triggered during page load
		// WooCommerce hooks fire during admin page loads even when not saving
		// Check if we're actually in a save context by looking at $_POST data
		if ( is_admin() && ! wp_doing_ajax() && ! wp_doing_cron() ) {
			// Check if this is a real save operation (has POST data) or just a page load
			// During page load, $_POST is empty or only contains non-save data
			$is_save_operation = (
				! empty( $_POST ) && 
				( isset( $_POST['save'] ) || isset( $_POST['publish'] ) || isset( $_POST['update'] ) || 
				  isset( $_POST['post_ID'] ) || isset( $_POST['product_id'] ) ||
				  ( isset( $_POST['action'] ) && $_POST['action'] === 'editpost' )
				)
			);
			
			if ( ! $is_save_operation ) {
				// This is a page load, not a save - skip webhook
				return;
			}
		}
		
		// Skip if WooCommerce functions are not available
		if ( ! function_exists( 'wc_get_product' ) ) {
			return;
		}
		
		// Skip autosaves and revisions
		if ( wp_is_post_autosave( $product_id ) || wp_is_post_revision( $product_id ) ) {
			return;
		}
		
		// Skip if product ID is invalid
		if ( ! $product_id || ! is_numeric( $product_id ) ) {
			return;
		}
		
		// Verify it's actually a product (with error handling)
		try {
			$product = wc_get_product( $product_id );
			if ( ! $product ) {
				return;
			}
			
			// Only send webhook for published products (skip drafts during editing)
			$post_status = get_post_status( $product_id );
			if ( 'publish' !== $post_status && 'private' !== $post_status ) {
				// Don't send webhook for drafts, pending, etc.
				// This prevents errors when creating new products
				return;
			}
			
			// Send webhook directly (but catch any errors)
			$this->send_webhook( 'product.updated', 'product', (string) $product_id );
		} catch ( Exception $e ) {
			// Log error but don't break WordPress functionality
			error_log( sprintf( 'AI Woo Chat: Error handling product update for ID %s: %s', $product_id, $e->getMessage() ) );
			return;
		} catch ( Error $e ) {
			// Catch fatal errors too
			error_log( sprintf( 'AI Woo Chat: Fatal error handling product update for ID %s: %s', $product_id, $e->getMessage() ) );
			return;
		}
	}
	
	/**
	 * Handle product deleted
	 *
	 * @param int $product_id Product ID
	 */
	public function handle_product_deleted( $product_id ) {
		$this->send_webhook( 'product.deleted', 'product', (string) $product_id );
	}
	
	/**
	 * Handle product variation saved
	 *
	 * @param int $variation_id Variation ID
	 * @param int $product_id Parent product ID
	 */
	public function handle_product_variation_saved( $variation_id, $product_id ) {
		// When variation is saved, also update parent product
		$this->handle_product_updated( $product_id );
	}
	
	/**
	 * Handle post/page saved
	 *
	 * @param int     $post_id Post ID
	 * @param WP_Post $post    Post object
	 * @param bool    $update  Whether this is an update
	 */
	public function handle_post_saved( $post_id, $post, $update ) {
		// CRITICAL: Skip during AJAX requests (prevents interference with admin-ajax.php)
		// This is the most important check - admin-ajax.php uses AJAX
		if ( wp_doing_ajax() ) {
			return;
		}
		
		// Skip during cron jobs
		if ( wp_doing_cron() ) {
			return;
		}
		
		// Skip during REST API requests (WordPress REST API)
		if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
			return;
		}
		
		// CRITICAL: Skip if we're in admin area and this hook was triggered during page load
		// save_post hook fires during admin page loads even when not saving
		// Check if we're actually in a save context by looking at $_POST data
		if ( is_admin() && ! wp_doing_ajax() && ! wp_doing_cron() ) {
			// Check if this is a real save operation (has POST data) or just a page load
			// During page load, $_POST is empty or only contains non-save data
			$is_save_operation = (
				! empty( $_POST ) && 
				( isset( $_POST['save'] ) || isset( $_POST['publish'] ) || isset( $_POST['update'] ) || 
				  isset( $_POST['post_ID'] ) || isset( $_POST['post_id'] ) ||
				  ( isset( $_POST['action'] ) && $_POST['action'] === 'editpost' )
				)
			);
			
			if ( ! $is_save_operation ) {
				// This is a page load, not a save - skip webhook
				return;
			}
		}
		
		// Skip if post is not valid
		if ( ! $post_id || ! $post || ! is_object( $post ) ) {
			return;
		}
		
		// Skip autosaves and revisions
		if ( wp_is_post_autosave( $post_id ) || wp_is_post_revision( $post_id ) ) {
			return;
		}
		
		// Skip WooCommerce product posts (handled by WooCommerce hooks)
		if ( 'product' === $post->post_type && class_exists( 'WooCommerce' ) ) {
			return;
		}
		
		// Skip if this is a product draft being created (WooCommerce creates draft first)
		if ( 'product' === $post->post_type && 'draft' === $post->post_status ) {
			return;
		}
		
		// Only handle published posts/pages
		if ( 'publish' !== $post->post_status && 'private' !== $post->post_status ) {
			return;
		}
		
		// Determine entity type
		$entity_type = null;
		$event_type = null;
		
		// Check if it's a policy page (shipping, returns, terms, privacy)
		$policy_slugs = array( 'shipping', 'returns', 'terms', 'privacy', 'refund', 'cancellation' );
		$post_slug = $post->post_name;
		
		if ( in_array( $post_slug, $policy_slugs, true ) || 
		     stripos( $post->post_title, 'shipping' ) !== false ||
		     stripos( $post->post_title, 'return' ) !== false ||
		     stripos( $post->post_title, 'term' ) !== false ||
		     stripos( $post->post_title, 'privacy' ) !== false ) {
			$entity_type = 'policy';
			$event_type = 'policy.updated';
		} elseif ( 'page' === $post->post_type ) {
			$entity_type = 'page';
			$event_type = 'page.updated';
		} elseif ( 'post' === $post->post_type ) {
			// Regular blog posts - could be FAQ or other content
			$entity_type = 'page';
			$event_type = 'page.updated';
		}
		
		if ( $entity_type && $event_type ) {
			$this->send_webhook( $event_type, $entity_type, (string) $post_id );
		}
	}
	
	/**
	 * Handle post/page deleted
	 *
	 * @param int $post_id Post ID
	 */
	public function handle_post_deleted( $post_id ) {
		$post = get_post( $post_id );
		if ( ! $post ) {
			return;
		}
		
		// Determine entity type
		$entity_type = null;
		$event_type = null;
		
		// Check if it's a policy page
		$policy_slugs = array( 'shipping', 'returns', 'terms', 'privacy', 'refund', 'cancellation' );
		$post_slug = $post->post_name;
		
		if ( in_array( $post_slug, $policy_slugs, true ) || 
		     stripos( $post->post_title, 'shipping' ) !== false ||
		     stripos( $post->post_title, 'return' ) !== false ||
		     stripos( $post->post_title, 'term' ) !== false ||
		     stripos( $post->post_title, 'privacy' ) !== false ) {
			$entity_type = 'policy';
			$event_type = 'page.deleted'; // Use page.deleted for policies too
		} elseif ( 'page' === $post->post_type || 'post' === $post->post_type ) {
			$entity_type = 'page';
			$event_type = 'page.deleted';
		}
		
		if ( $entity_type && $event_type ) {
			$this->send_webhook( $event_type, $entity_type, (string) $post_id );
		}
	}
	
	/**
	 * Send webhook to SaaS platform
	 *
	 * @param string $event_type Event type (product.updated, product.deleted, etc.)
	 * @param string $entity_type Entity type (product, page, policy)
	 * @param string $entity_id Entity ID
	 * @return bool|WP_Error True on success, WP_Error on failure
	 */
	private function send_webhook( $event_type, $entity_type, $entity_id ) {
		// Wrap in try-catch to prevent breaking WordPress functionality
		try {
			$options = AI_Woo_Chat_Options::get_instance();
			
			// Check if plugin is activated
			if ( ! $options->is_activated() ) {
				return new WP_Error(
					'not_activated',
					__( 'Plugin is not activated. Webhook not sent.', 'ai-woo-chat' )
				);
			}
			
			// Get SaaS URL and credentials
			$saas_url = $options->get_saas_url();
			$site_id = $options->get_site_id();
			$site_secret = $options->get_site_secret();
			
			if ( ! $saas_url || ! $site_id || ! $site_secret ) {
				error_log( sprintf(
					'AI Woo Chat: Missing credentials for webhook - site_id: %s, saas_url: %s, secret: %s',
					$site_id ? 'present' : 'missing',
					$saas_url ? 'present' : 'missing',
					$site_secret ? 'present' : 'missing'
				) );
				return new WP_Error(
					'missing_credentials',
					__( 'Missing SaaS credentials. Webhook not sent.', 'ai-woo-chat' )
				);
			}
		
			// Generate event ID (UUID v4)
			$event_id = $this->generate_uuid();
			
			// Prepare webhook payload
			$payload = array(
				'event_id'    => $event_id,
				'event'       => $event_type,
				'entity_type' => $entity_type,
				'entity_id'   => $entity_id,
				'occurred_at' => gmdate( 'c' ), // ISO 8601 format
			);
			
			// Get HMAC signer
			$signer = AI_Woo_Chat_HMAC_Signer::get_instance();
			
			// Build webhook URL
			$webhook_url = rtrim( $saas_url, '/' ) . '/api/ingestion/webhook';
			
			// Send webhook with HMAC signature
			$response = $signer->make_signed_request(
				'POST',
				$webhook_url,
				array(
					'body'    => wp_json_encode( $payload ),
					'timeout' => 10,
				)
			);
			
			// Log result (for debugging)
			if ( is_wp_error( $response ) ) {
				error_log( sprintf(
					'AI Woo Chat: Webhook failed for %s %s (ID: %s) - %s',
					$entity_type,
					$event_type,
					$entity_id,
					$response->get_error_message()
				) );
				return $response;
			}
			
			$response_code = wp_remote_retrieve_response_code( $response );
			if ( 200 !== $response_code ) {
				$response_body = wp_remote_retrieve_body( $response );
				error_log( sprintf(
					'AI Woo Chat: Webhook returned %d for %s %s (ID: %s) - Site ID: %s - %s',
					$response_code,
					$entity_type,
					$event_type,
					$entity_id,
					$site_id,
					$response_body
				) );
				return new WP_Error(
					'webhook_failed',
					sprintf( __( 'Webhook returned status %d', 'ai-woo-chat' ), $response_code )
				);
			}
			
			// Success
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
				error_log( sprintf(
					'AI Woo Chat: Webhook sent successfully for %s %s (ID: %s)',
					$entity_type,
					$event_type,
					$entity_id
				) );
			}
			
			return true;
		} catch ( Exception $e ) {
			// Log error but don't break WordPress functionality
			error_log( sprintf(
				'AI Woo Chat: Exception sending webhook for %s %s (ID: %s) - %s',
				$entity_type,
				$event_type,
				$entity_id,
				$e->getMessage()
			) );
			return new WP_Error( 'webhook_exception', $e->getMessage() );
		} catch ( Error $e ) {
			// Catch fatal errors too
			error_log( sprintf(
				'AI Woo Chat: Fatal error sending webhook for %s %s (ID: %s) - %s',
				$entity_type,
				$event_type,
				$entity_id,
				$e->getMessage()
			) );
			return new WP_Error( 'webhook_fatal_error', $e->getMessage() );
		}
	}
	
	/**
	 * Generate UUID v4
	 *
	 * @return string UUID
	 */
	private function generate_uuid() {
		// Generate random UUID v4
		$data = random_bytes( 16 );
		
		// Set version (4) and variant bits
		$data[6] = chr( ord( $data[6] ) & 0x0f | 0x40 ); // Version 4
		$data[8] = chr( ord( $data[8] ) & 0x3f | 0x80 ); // Variant bits
		
		return vsprintf( '%s%s-%s-%s-%s-%s%s%s', str_split( bin2hex( $data ), 4 ) );
	}
}
