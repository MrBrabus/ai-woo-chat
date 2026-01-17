<?php
/**
 * REST API helper functions
 *
 * Provides convenience functions for working with REST API and HMAC.
 *
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Helper functions for REST API
 */
class AI_Woo_Chat_REST_Helper {
	
	/**
	 * Create standardized error response
	 *
	 * @param string $code Error code
	 * @param string $message Error message
	 * @param array  $details Additional details
	 * @param int    $status HTTP status code
	 * @return WP_REST_Response
	 */
	public static function error_response( $code, $message, $details = array(), $status = 400 ) {
		$response_data = array(
			'error' => array(
				'code'    => $code,
				'message' => $message,
			),
		);
		
		if ( ! empty( $details ) ) {
			$response_data['error']['details'] = $details;
		}
		
		return new WP_REST_Response( $response_data, $status );
	}
	
	/**
	 * Create standardized success response
	 *
	 * @param mixed $data Response data
	 * @param int   $status HTTP status code
	 * @return WP_REST_Response
	 */
	public static function success_response( $data = null, $status = 200 ) {
		if ( null === $data ) {
			$data = array( 'success' => true );
		}
		
		return new WP_REST_Response( $data, $status );
	}
	
	/**
	 * Validate required parameters
	 *
	 * @param WP_REST_Request $request Request object
	 * @param array           $required Required parameter names
	 * @return WP_Error|null Error if validation fails, null if valid
	 */
	public static function validate_required_params( $request, $required ) {
		$missing = array();
		
		foreach ( $required as $param ) {
			$value = $request->get_param( $param );
			if ( empty( $value ) && '0' !== $value ) {
				$missing[] = $param;
			}
		}
		
		if ( ! empty( $missing ) ) {
			return new WP_Error(
				'missing_required_field',
				__( 'Missing required fields', 'ai-woo-chat' ),
				array(
					'status' => 400,
					'fields' => $missing,
				)
			);
		}
		
		return null;
	}
}
