<?php
/**
 * Example REST API endpoint with HMAC authentication
 * 
 * This is a reference implementation showing how to use HMAC middleware
 * in your REST API endpoints. Copy this pattern for actual endpoints.
 * 
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Example: How to register a REST API endpoint with HMAC authentication
 * 
 * Add this to AI_Woo_Chat_REST_API::register_routes()
 */
function example_register_hmac_protected_route() {
	$rest_api = AI_Woo_Chat_REST_API::get_instance();
	
	register_rest_route(
		AI_Woo_Chat_REST_API::NAMESPACE,
		'/example-endpoint',
		array(
			'methods'             => 'POST',
			'callback'            => 'example_endpoint_handler',
			'permission_callback' => array( $rest_api, 'hmac_auth_middleware' ),
			'args'                => array(
				'param1' => array(
					'required' => true,
					'type'     => 'string',
					'validate_callback' => function( $param ) {
						return ! empty( $param );
					},
				),
			),
		)
	);
}

/**
 * Example endpoint handler
 * 
 * @param WP_REST_Request $request Request object
 * @return WP_REST_Response|WP_Error
 */
function example_endpoint_handler( $request ) {
	// HMAC validation already passed (via permission_callback)
	// You can safely process the request here
	
	$param1 = $request->get_param( 'param1' );
	
	// Your endpoint logic here
	
	return AI_Woo_Chat_REST_Helper::success_response( array(
		'result' => 'success',
		'data'   => $param1,
	) );
}
