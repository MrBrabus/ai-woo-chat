<?php
/**
 * HMAC signer for outgoing requests
 *
 * Handles signing of requests from WordPress to SaaS platform
 * (e.g., webhook notifications).
 *
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI_Woo_Chat_HMAC_Signer class
 */
class AI_Woo_Chat_HMAC_Signer {
	
	/**
	 * Single instance
	 *
	 * @var AI_Woo_Chat_HMAC_Signer
	 */
	private static $instance = null;
	
	/**
	 * Get singleton instance
	 *
	 * @return AI_Woo_Chat_HMAC_Signer
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
		// Private constructor for singleton
	}
	
	/**
	 * Sign a request to SaaS platform
	 *
	 * @param string $method HTTP method
	 * @param string $url Full URL (e.g., 'https://api.aiwoochat.com/api/ingestion/webhook')
	 * @param string $body Request body (JSON string)
	 * @return array|WP_Error Headers array or error
	 */
	public function sign_request( $method, $url, $body = '' ) {
		$hmac = AI_Woo_Chat_HMAC::get_instance();
		
		// Parse URL to get path
		$parsed_url = wp_parse_url( $url );
		$path = isset( $parsed_url['path'] ) ? $parsed_url['path'] : '/';
		
		// Add query string if present
		if ( ! empty( $parsed_url['query'] ) ) {
			$path .= '?' . $parsed_url['query'];
		}
		
		// Generate HMAC headers
		$headers = $hmac->generate_headers( $method, $path, $body );
		
		return $headers;
	}
	
	/**
	 * Make signed request to SaaS platform
	 *
	 * @param string $method HTTP method
	 * @param string $url Full URL
	 * @param array  $args Request arguments (body, headers, etc.)
	 * @return array|WP_Error Response or error
	 */
	public function make_signed_request( $method, $url, $args = array() ) {
		// Get body for signing
		$body = isset( $args['body'] ) ? ( is_array( $args['body'] ) ? wp_json_encode( $args['body'] ) : $args['body'] ) : '';
		
		// Sign request
		$hmac_headers = $this->sign_request( $method, $url, $body );
		
		if ( is_wp_error( $hmac_headers ) ) {
			return $hmac_headers;
		}
		
		// Merge HMAC headers with existing headers
		$headers = isset( $args['headers'] ) ? $args['headers'] : array();
		$headers = array_merge( $headers, $hmac_headers );
		
		// Add Content-Type if body is present
		if ( ! empty( $body ) && ! isset( $headers['Content-Type'] ) ) {
			$headers['Content-Type'] = 'application/json';
		}
		
		// Prepare request args
		$request_args = array_merge( $args, array(
			'method'  => $method,
			'headers' => $headers,
			'body'    => $body,
		) );
		
		// Make request
		$response = wp_remote_request( $url, $request_args );
		
		return $response;
	}
}
