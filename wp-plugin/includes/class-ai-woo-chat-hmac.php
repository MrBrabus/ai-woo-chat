<?php
/**
 * HMAC signing and validation class
 *
 * Handles HMAC-SHA256 signing for requests to SaaS platform
 * and validation of incoming requests from SaaS platform.
 *
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI_Woo_Chat_HMAC class
 */
class AI_Woo_Chat_HMAC {
	
	/**
	 * Single instance
	 *
	 * @var AI_Woo_Chat_HMAC
	 */
	private static $instance = null;
	
	/**
	 * Timestamp tolerance in seconds (5 minutes)
	 */
	const TIMESTAMP_TOLERANCE = 300;
	
	/**
	 * Nonce cache expiration in seconds (10 minutes)
	 */
	const NONCE_CACHE_EXPIRATION = 600;
	
	/**
	 * Get singleton instance
	 *
	 * @return AI_Woo_Chat_HMAC
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
	 * Generate HMAC headers for outgoing request
	 *
	 * @param string $method HTTP method (GET, POST, etc.)
	 * @param string $path Request path (including query string if any)
	 * @param string $body Request body (empty string for GET requests)
	 * @return array|WP_Error Headers array or error
	 */
	public function generate_headers( $method, $path, $body = '' ) {
		$options = AI_Woo_Chat_Options::get_instance();
		
		// Check if activated
		if ( ! $options->is_activated() ) {
			return new WP_Error(
				'not_activated',
				__( 'Plugin is not activated', 'ai-woo-chat' )
			);
		}
		
		$site_id = $options->get_site_id();
		$site_secret = $options->get_site_secret();
		
		// Generate timestamp
		$timestamp = time();
		
		// Generate nonce (UUID v4)
		$nonce = $this->generate_uuid_v4();
		
		// Calculate body hash (must be lowercase hex)
		$body_hash = ! empty( $body ) ? strtolower( hash( 'sha256', $body ) ) : '';
		
		// Build canonical string (exactly as per API contract)
		$canonical_string = sprintf(
			"%s\n%s\n%d\n%s\n%s",
			strtoupper( $method ),
			$path,
			$timestamp,
			$nonce,
			$body_hash
		);
		
		// Generate signature
		$signature = hash_hmac( 'sha256', $canonical_string, $site_secret, true );
		$signature_b64 = base64_encode( $signature );
		
		// Return headers
		return array(
			'X-AI-Site'  => $site_id,
			'X-AI-Ts'    => (string) $timestamp,
			'X-AI-Nonce' => $nonce,
			'X-AI-Sign'  => $signature_b64,
		);
	}
	
	/**
	 * Validate incoming HMAC request
	 *
	 * @param string $method HTTP method
	 * @param string $path Request path (should include query string if present)
	 * @param string $body Request body
	 * @return bool|WP_Error True if valid, WP_Error if invalid
	 */
	public function validate_request( $method, $path, $body = '' ) {
		$options = AI_Woo_Chat_Options::get_instance();
		
		// Check if plugin is activated
		if ( ! $options->is_activated() ) {
			return new WP_Error(
				'not_activated',
				__( 'Plugin is not activated', 'ai-woo-chat' ),
				array( 'status' => 403 )
			);
		}
		
		// Get headers (WordPress REST API may normalize header names)
		$site_id = $this->get_header( 'X-AI-Site' );
		$timestamp = $this->get_header( 'X-AI-Ts' );
		$nonce = $this->get_header( 'X-AI-Nonce' );
		$signature = $this->get_header( 'X-AI-Sign' );
		
		// Validate headers present
		if ( empty( $site_id ) || empty( $timestamp ) || empty( $nonce ) || empty( $signature ) ) {
			return new WP_Error(
				'missing_headers',
				__( 'Missing required HMAC headers', 'ai-woo-chat' ),
				array( 'status' => 401 )
			);
		}
		
		// Validate site ID matches
		if ( $site_id !== $options->get_site_id() ) {
			return new WP_Error(
				'invalid_site_id',
				__( 'Invalid site ID', 'ai-woo-chat' ),
				array( 'status' => 403 )
			);
		}
		
		// Validate timestamp format (must be numeric)
		if ( ! is_numeric( $timestamp ) ) {
			return new WP_Error(
				'invalid_timestamp_format',
				__( 'Invalid timestamp format', 'ai-woo-chat' ),
				array( 'status' => 401 )
			);
		}
		
		// Validate timestamp (within ±5 minutes tolerance)
		$timestamp_int = (int) $timestamp;
		$current_time = time();
		$time_diff = abs( $current_time - $timestamp_int );
		
		if ( $time_diff > self::TIMESTAMP_TOLERANCE ) {
			// Generic error message (avoid leaking timing information)
			return new WP_Error(
				'invalid_timestamp',
				__( 'Request timestamp is outside acceptable range', 'ai-woo-chat' ),
				array( 'status' => 401 )
			);
		}
		
		// Validate nonce format (must be UUID v4)
		if ( ! preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $nonce ) ) {
			return new WP_Error(
				'invalid_nonce_format',
				__( 'Invalid nonce format (must be UUID v4)', 'ai-woo-chat' ),
				array( 'status' => 401 )
			);
		}
		
		// Validate nonce (not reused)
		if ( ! $this->validate_nonce( $nonce ) ) {
			return new WP_Error(
				'reused_nonce',
				__( 'Nonce has been reused (replay attack detected)', 'ai-woo-chat' ),
				array( 'status' => 401 )
			);
		}
		
		// Calculate body hash (must be lowercase hex)
		$body_hash = ! empty( $body ) ? strtolower( hash( 'sha256', $body ) ) : '';
		
		// Build canonical string (exactly as per API contract)
		$canonical_string = sprintf(
			"%s\n%s\n%d\n%s\n%s",
			strtoupper( $method ),
			$path,
			$timestamp_int,
			$nonce,
			$body_hash
		);
		
		// Calculate expected signature
		$site_secret = $options->get_site_secret();
		$expected_signature = hash_hmac( 'sha256', $canonical_string, $site_secret, true );
		$expected_signature_b64 = base64_encode( $expected_signature );
		
		// Validate signature format (must be base64)
		if ( ! preg_match( '/^[A-Za-z0-9+\/]+=*$/', $signature ) ) {
			return new WP_Error(
				'invalid_signature_format',
				__( 'Invalid signature format (must be base64)', 'ai-woo-chat' ),
				array( 'status' => 403 )
			);
		}
		
		// Decode base64 signature to bytes for comparison
		$expected_signature_bytes = base64_decode( $expected_signature_b64, true );
		$received_signature_bytes = base64_decode( $signature, true );
		
		// Validate base64 decoding succeeded
		if ( false === $expected_signature_bytes || false === $received_signature_bytes ) {
			return new WP_Error(
				'invalid_signature_format',
				__( 'Invalid signature format', 'ai-woo-chat' ),
				array( 'status' => 403 )
			);
		}
		
		// Compare signature bytes using hash_equals (timing-safe)
		if ( ! hash_equals( $expected_signature_bytes, $received_signature_bytes ) ) {
			return new WP_Error(
				'invalid_signature',
				__( 'Invalid HMAC signature', 'ai-woo-chat' ),
				array( 'status' => 403 )
			);
		}
		
		// Store nonce to prevent reuse (only after successful validation)
		$this->store_nonce( $nonce );
		
		return true;
	}
	
	/**
	 * Generate UUID v4
	 *
	 * @return string
	 */
	private function generate_uuid_v4() {
		// Generate random bytes
		$data = random_bytes( 16 );
		
		// Set version (4) and variant bits
		$data[6] = chr( ord( $data[6] ) & 0x0f | 0x40 ); // Version 4
		$data[8] = chr( ord( $data[8] ) & 0x3f | 0x80 ); // Variant bits
		
		// Format as UUID
		return sprintf(
			'%08s-%04s-%04s-%04s-%12s',
			bin2hex( substr( $data, 0, 4 ) ),
			bin2hex( substr( $data, 4, 2 ) ),
			bin2hex( substr( $data, 6, 2 ) ),
			bin2hex( substr( $data, 8, 2 ) ),
			bin2hex( substr( $data, 10, 6 ) )
		);
	}
	
	/**
	 * Validate nonce (check if not reused)
	 * Namespaced by site_id to avoid cross-site collisions
	 *
	 * @param string $nonce Nonce to validate
	 * @return bool True if valid (not seen before), false if reused
	 */
	private function validate_nonce( $nonce ) {
		$options = AI_Woo_Chat_Options::get_instance();
		$site_id = $options->get_site_id();
		
		// Namespace by site_id to avoid cross-site collisions
		$transient_key = 'ai_woo_chat_nonce_' . md5( $site_id . '_' . $nonce );
		$exists = get_transient( $transient_key );
		
		// If exists, nonce was reused
		// Note: WordPress transients are atomic, so race conditions are minimal
		// However, for extra safety, we check before storing (in validate_request)
		return false === $exists;
	}
	
	/**
	 * Store nonce to prevent reuse
	 * Namespaced by site_id to avoid cross-site collisions
	 *
	 * @param string $nonce Nonce to store
	 * @return void
	 */
	private function store_nonce( $nonce ) {
		$options = AI_Woo_Chat_Options::get_instance();
		$site_id = $options->get_site_id();
		
		// Namespace by site_id to avoid cross-site collisions
		// Also include nonce hash for uniqueness
		$transient_key = 'ai_woo_chat_nonce_' . md5( $site_id . '_' . $nonce );
		
		// Store with timestamp for debugging (optional)
		set_transient( $transient_key, time(), self::NONCE_CACHE_EXPIRATION );
	}
	
	/**
	 * Get HTTP header value (case-insensitive)
	 * Handles various header name formats and PHP/WordPress header mapping
	 *
	 * @param string $header_name Header name (e.g., 'X-AI-Site')
	 * @return string Header value or empty string
	 */
	private function get_header( $header_name ) {
		// Normalize header name for comparison
		$normalized_name = strtolower( $header_name );
		
		// Try direct server variable first (HTTP_X_AI_SITE format)
		$server_key = 'HTTP_' . str_replace( '-', '_', strtoupper( $header_name ) );
		if ( isset( $_SERVER[ $server_key ] ) ) {
			return sanitize_text_field( wp_unslash( $_SERVER[ $server_key ] ) );
		}
		
		// Try getallheaders() if available (case-insensitive search)
		if ( function_exists( 'getallheaders' ) ) {
			$headers = getallheaders();
			if ( $headers ) {
				// Search case-insensitively
				foreach ( $headers as $key => $value ) {
					if ( strtolower( $key ) === $normalized_name ) {
						return sanitize_text_field( wp_unslash( $value ) );
					}
				}
			}
		}
		
		// Try WordPress REST API request headers (if available in context)
		// Note: This is a fallback, primary method should work
		
		return '';
	}
	
	/**
	 * Build canonical path from REST API route
	 * Includes query string if present (normalized per RFC3986)
	 *
	 * @param string $route REST API route (e.g., '/ai-chat/v1/product/123')
	 * @param array  $query_params Query parameters
	 * @return string Canonical path
	 */
	public function build_canonical_path( $route, $query_params = array() ) {
		$path = $route;
		
		// Add query string if present
		if ( ! empty( $query_params ) ) {
			// Normalize query params deterministically
			$normalized = $this->normalize_query_params( $query_params );
			
			// Build query string with RFC3986 encoding
			$query_parts = array();
			foreach ( $normalized as $key => $value ) {
				// RFC3986 encoding (rawurlencode)
				$encoded_key = rawurlencode( $key );
				if ( is_array( $value ) ) {
					// Handle repeated params: sort values, then encode each
					sort( $value );
					foreach ( $value as $v ) {
						$query_parts[] = $encoded_key . '=' . rawurlencode( (string) $v );
					}
				} else {
					// Empty values: include key with empty value
					$encoded_value = $value === null || $value === '' ? '' : rawurlencode( (string) $value );
					$query_parts[] = $encoded_key . ( $encoded_value !== '' ? '=' . $encoded_value : '' );
				}
			}
			
			// Sort query parts by key=value (deterministic)
			sort( $query_parts );
			
			// Join with & and prepend ?
			$query_string = implode( '&', $query_parts );
			$path .= '?' . $query_string;
		}
		
		return $path;
	}
	
	/**
	 * Normalize query parameters for canonical string
	 * Handles repeated params, empty values, and sorting
	 *
	 * @param array $params Query parameters
	 * @return array Normalized parameters
	 */
	private function normalize_query_params( $params ) {
		$normalized = array();
		
		foreach ( $params as $key => $value ) {
			// Normalize key (lowercase for consistency, though API contract doesn't specify)
			$normalized_key = $key;
			
			if ( is_array( $value ) ) {
				// Handle repeated params: keep as array, will be sorted later
				$normalized[ $normalized_key ] = $value;
			} else {
				// Single value (including empty/null)
				$normalized[ $normalized_key ] = $value;
			}
		}
		
		// Sort by key (deterministic)
		ksort( $normalized );
		
		return $normalized;
	}
}
