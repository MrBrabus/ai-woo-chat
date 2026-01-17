<?php
/**
 * License activation class
 *
 * Handles license activation flow with SaaS platform.
 *
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI_Woo_Chat_License class
 */
class AI_Woo_Chat_License {
	
	/**
	 * Single instance
	 *
	 * @var AI_Woo_Chat_License
	 */
	private static $instance = null;
	
	/**
	 * Get singleton instance
	 *
	 * @return AI_Woo_Chat_License
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
	 * Activate license with SaaS platform
	 *
	 * @param string $license_key License key
	 * @return array|WP_Error Response data or error
	 */
	public function activate( $license_key ) {
		$options = AI_Woo_Chat_Options::get_instance();
		$saas_url = $options->get_saas_url();
		
		// Debug: Log the URL being used (remove in production)
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( 'AI Woo Chat: Activating with SaaS URL: ' . $saas_url );
		}
		
		// Prepare request data
		$site_url = home_url();
		$site_name = get_bloginfo( 'name' );
		
		$request_data = array(
			'license_key' => sanitize_text_field( $license_key ),
			'site_url'    => esc_url_raw( $site_url ),
			'site_name'   => sanitize_text_field( $site_name ),
		);
		
		// Make API request (ensure URL has trailing slash)
		$api_url = rtrim( $saas_url, '/' ) . '/api/license/activate';
		
		// Debug: Log the full URL being used
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( 'AI Woo Chat: Activation API URL: ' . $api_url );
			error_log( 'AI Woo Chat: Request data: ' . wp_json_encode( $request_data ) );
		}
		
		$response = wp_remote_post(
			$api_url,
			array(
				'timeout'     => 30,
				'sslverify'   => true, // Verify SSL certificate
				'headers'     => array(
					'Content-Type' => 'application/json',
					'User-Agent'   => 'AI-Woo-Chat-Plugin/1.0',
				),
				'body'        => wp_json_encode( $request_data ),
				'data_format' => 'body',
			)
		);
		
		// Handle errors
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		
		$response_code = wp_remote_retrieve_response_code( $response );
		$response_body = wp_remote_retrieve_body( $response );
		$response_data = json_decode( $response_body, true );
		
		// Debug: Log response details
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( 'AI Woo Chat: Activation response code: ' . $response_code );
			error_log( 'AI Woo Chat: Activation response body: ' . $response_body );
		}
		
		// Handle non-200 responses
		if ( 200 !== $response_code ) {
			$error_message = isset( $response_data['error']['message'] ) 
				? $response_data['error']['message'] 
				: sprintf( 
					__( 'Activation failed with status code %d', 'ai-woo-chat' ),
					$response_code
				);
			
			$error_code = isset( $response_data['error']['code'] ) 
				? $response_data['error']['code'] 
				: 'activation_failed';
			
			return new WP_Error( $error_code, $error_message, array( 'status' => $response_code ) );
		}
		
		// Validate response structure
		if ( ! isset( $response_data['site_id'] ) || ! isset( $response_data['site_secret'] ) ) {
			return new WP_Error(
				'invalid_response',
				__( 'Invalid response from activation server', 'ai-woo-chat' ),
				array( 'status' => 500 )
			);
		}
		
		// Validate site_id format (UUID)
		if ( ! preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $response_data['site_id'] ) ) {
			return new WP_Error(
				'invalid_site_id',
				__( 'Invalid site ID format received from server', 'ai-woo-chat' ),
				array( 'status' => 500 )
			);
		}
		
		// Validate site_secret format
		if ( ! preg_match( '/^sec_[a-f0-9]{64}$/', $response_data['site_secret'] ) ) {
			return new WP_Error(
				'invalid_site_secret',
				__( 'Invalid site secret format received from server', 'ai-woo-chat' ),
				array( 'status' => 500 )
			);
		}
		
		// Store credentials (with validation)
		$site_id_saved = $options->set_site_id( $response_data['site_id'] );
		$site_secret_saved = $options->set_site_secret( $response_data['site_secret'] );
		
		if ( ! $site_id_saved || ! $site_secret_saved ) {
			return new WP_Error(
				'storage_failed',
				__( 'Failed to store activation credentials', 'ai-woo-chat' ),
				array( 'status' => 500 )
			);
		}
		
		$options->set_license_key( $license_key );
		$options->set_status( 'active' );
		
		// Clear any error status
		delete_transient( 'ai_woo_chat_activation_error' );
		
		return array(
			'site_id'    => $response_data['site_id'],
			'status'     => isset( $response_data['status'] ) ? $response_data['status'] : 'active',
			'expires_at' => isset( $response_data['expires_at'] ) ? $response_data['expires_at'] : null,
		);
	}
	
	/**
	 * Deactivate license (clear local credentials)
	 *
	 * @return bool|WP_Error
	 */
	public function deactivate() {
		$options = AI_Woo_Chat_Options::get_instance();
		
		// Store license key before clearing (for easy reactivation)
		$license_key = $options->get_license_key();
		
		// Clear activation data
		$options->clear_activation();
		
		// Restore license key for reactivation
		if ( ! empty( $license_key ) ) {
			$options->set_license_key( $license_key );
		}
		
		// Set status to inactive
		$options->set_status( 'inactive' );
		
		return true;
	}
}
