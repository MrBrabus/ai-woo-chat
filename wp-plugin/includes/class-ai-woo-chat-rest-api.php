<?php
/**
 * REST API class
 *
 * Skeleton for WordPress REST API endpoints that will be called by SaaS platform.
 * Currently empty - endpoints will be added in future tasks.
 *
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI_Woo_Chat_REST_API class
 */
class AI_Woo_Chat_REST_API {
	
	/**
	 * Single instance
	 *
	 * @var AI_Woo_Chat_REST_API
	 */
	private static $instance = null;
	
	/**
	 * Namespace
	 */
	const NAMESPACE = 'ai-chat/v1';
	
	/**
	 * Get singleton instance
	 *
	 * @return AI_Woo_Chat_REST_API
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
	 * Initialize REST API
	 */
	private function init() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}
	
	/**
	 * Register REST API routes
	 *
	 * Placeholder for future endpoints:
	 * - GET /site/context
	 * - GET /product/{id}
	 * - GET /product/{id}/live
	 * - GET /products/changed
	 * - POST /products/batch
	 * - POST /order/status
	 */
	public function register_routes() {
		// Routes will be registered here in future tasks (To-Do #8)
		// All routes will use HMAC middleware for authentication via permission_callback
	}
	
	/**
	 * HMAC authentication middleware for REST API
	 *
	 * Validates HMAC signature for REST API requests from SaaS platform.
	 * Use this as permission_callback in register_rest_route().
	 *
	 * @param WP_REST_Request $request Request object
	 * @return bool|WP_Error True if authenticated, WP_Error if not
	 */
	public function hmac_auth_middleware( $request ) {
		$hmac = AI_Woo_Chat_HMAC::get_instance();
		
		// Get request method
		$method = $request->get_method();
		
		// Get full route path (includes namespace, e.g., '/ai-chat/v1/product/123')
		$route = $request->get_route();
		
		// Get query parameters for canonical path
		$query_params = $request->get_query_params();
		
		// Build canonical path (route + query string)
		$canonical_path = $hmac->build_canonical_path( $route, $query_params );
		
		// Get request body (raw bytes, not parsed JSON)
		// This ensures we hash the exact bytes sent, not a re-encoded version
		$body = $request->get_body();
		
		// Validate HMAC
		$result = $hmac->validate_request( $method, $canonical_path, $body );
		
		// If validation failed, return proper REST error
		if ( is_wp_error( $result ) ) {
			$status_code = $result->get_error_data( 'status' ) ? $result->get_error_data( 'status' ) : 401;
			
			return new WP_Error(
				$result->get_error_code(),
				$result->get_error_message(),
				array(
					'status' => $status_code,
				)
			);
		}
		
		return true;
	}
	
	/**
	 * Helper: Create standardized error response
	 *
	 * @param string $code Error code
	 * @param string $message Error message
	 * @param int    $status HTTP status code
	 * @return WP_Error
	 */
	public function create_error_response( $code, $message, $status = 401 ) {
		return new WP_Error(
			$code,
			$message,
			array( 'status' => $status )
		);
	}
}
