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
		$rest_api = self::get_instance();
		
		// GET /products/changed - Get list of changed products (paginated)
		register_rest_route(
			self::NAMESPACE,
			'/products/changed',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_products_changed' ),
				'permission_callback' => array( $rest_api, 'hmac_auth_middleware' ),
				'args'                => array(
					'updated_after' => array(
						'required' => false,
						'type'     => 'string',
						'default'  => '1970-01-01T00:00:00Z',
						'validate_callback' => function( $param ) {
							return ! empty( $param );
						},
					),
					'page' => array(
						'required' => false,
						'type'     => 'integer',
						'default'  => 1,
						'validate_callback' => function( $param ) {
							return is_numeric( $param ) && $param > 0;
						},
					),
					'per_page' => array(
						'required' => false,
						'type'     => 'integer',
						'default'  => 50,
						'validate_callback' => function( $param ) {
							return is_numeric( $param ) && $param > 0 && $param <= 100;
						},
					),
				),
			)
		);
		
		// GET /product/{id} - Get single product details for ingestion
		register_rest_route(
			self::NAMESPACE,
			'/product/(?P<id>\d+)',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_product' ),
				'permission_callback' => array( $rest_api, 'hmac_auth_middleware' ),
				'args'                => array(
					'id' => array(
						'required' => true,
						'type'     => 'integer',
						'validate_callback' => function( $param ) {
							return is_numeric( $param ) && $param > 0;
						},
					),
				),
			)
		);
	}
	
	/**
	 * Get list of changed products (paginated)
	 * 
	 * @param WP_REST_Request $request Request object
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_products_changed( $request ) {
		// HMAC validation already passed (via permission_callback)
		
		$updated_after = $request->get_param( 'updated_after' );
		$page = absint( $request->get_param( 'page' ) );
		$per_page = absint( $request->get_param( 'per_page' ) );
		
		// Limit per_page to max 100
		$per_page = min( $per_page, 100 );
		
		// Parse updated_after date
		$updated_after_timestamp = strtotime( $updated_after );
		if ( false === $updated_after_timestamp ) {
			return $this->create_error_response(
				'invalid_date',
				'Invalid updated_after date format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)',
				400
			);
		}
		
		// Check if WooCommerce is active
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_product' ) ) {
			return $this->create_error_response(
				'woocommerce_not_active',
				'WooCommerce is not active',
				503
			);
		}
		
		// Use WP_Query to get products updated after the specified date
		$query_args = array(
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => $per_page,
			'paged'          => $page,
			'orderby'        => 'modified',
			'order'          => 'ASC',
			'date_query'     => array(
				array(
					'column'    => 'post_modified',
					'after'     => date( 'Y-m-d H:i:s', $updated_after_timestamp ),
					'inclusive' => false,
				),
			),
		);
		
		$query = new WP_Query( $query_args );
		
		// Get total count for pagination
		$total = $query->found_posts;
		$total_pages = $query->max_num_pages;
		
		// Format response
		$formatted_products = array();
		foreach ( $query->posts as $post ) {
			$product = wc_get_product( $post->ID );
			if ( ! $product ) {
				continue;
			}
			
			$formatted_products[] = array(
				'id'         => $product->get_id(),
				'updated_at' => $product->get_date_modified()->date( 'c' ), // ISO 8601 format
			);
		}
		
		return rest_ensure_response( array(
			'products' => $formatted_products,
			'pagination' => array(
				'page'        => $page,
				'per_page'    => $per_page,
				'total'       => $total,
				'total_pages' => $total_pages,
			),
		) );
	}
	
	/**
	 * Get single product details for ingestion
	 * 
	 * @param WP_REST_Request $request Request object
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_product( $request ) {
		$product_id = absint( $request->get_param( 'id' ) );
		
		// Check if WooCommerce is active
		if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_product' ) ) {
			return $this->create_error_response(
				'woocommerce_not_active',
				'WooCommerce is not active',
				503
			);
		}
		
		// Get product
		$product = wc_get_product( $product_id );
		
		if ( ! $product ) {
			return $this->create_error_response(
				'product_not_found',
				'Product not found',
				404
			);
		}
		
		// Check if product is published
		if ( $product->get_status() !== 'publish' ) {
			return $this->create_error_response(
				'product_not_published',
				'Product is not published',
				404
			);
		}
		
		// Get product data
		$data = $this->format_product_for_ingestion( $product );
		
		return rest_ensure_response( $data );
	}
	
	/**
	 * Format product data for ingestion
	 * 
	 * @param WC_Product $product Product object
	 * @return array Formatted product data
	 */
	private function format_product_for_ingestion( $product ) {
		// Basic product data
		$data = array(
			'id'           => $product->get_id(),
			'title'        => $product->get_name(),
			'url'          => $product->get_permalink(),
			'sku'          => $product->get_sku(),
			'summary'      => $this->get_product_summary( $product ),
			'stock_status' => $product->get_stock_status(),
			'updated_at'   => $product->get_date_modified() ? $product->get_date_modified()->date( 'c' ) : null,
		);
		
		// Categories
		$categories = wp_get_post_terms( $product->get_id(), 'product_cat', array( 'fields' => 'names' ) );
		if ( ! is_wp_error( $categories ) && ! empty( $categories ) ) {
			$data['categories'] = $categories;
		}
		
		// Tags
		$tags = wp_get_post_terms( $product->get_id(), 'product_tag', array( 'fields' => 'names' ) );
		if ( ! is_wp_error( $tags ) && ! empty( $tags ) ) {
			$data['tags'] = $tags;
		}
		
		// Attributes
		$attributes = $product->get_attributes();
		if ( ! empty( $attributes ) ) {
			$formatted_attributes = array();
			foreach ( $attributes as $attribute ) {
				$attr_name = $attribute->get_name();
				if ( $attribute->is_taxonomy() ) {
					$attr_name = wc_attribute_label( $attr_name );
					$values = wc_get_product_terms( $product->get_id(), $attribute->get_name(), array( 'fields' => 'names' ) );
				} else {
					$values = $attribute->get_options();
				}
				if ( ! empty( $values ) ) {
					$formatted_attributes[ $attr_name ] = $values;
				}
			}
			if ( ! empty( $formatted_attributes ) ) {
				$data['attributes'] = $formatted_attributes;
			}
		}
		
		// Price range
		$price_data = $this->get_price_range( $product );
		if ( $price_data ) {
			$data['price_range'] = $price_data;
		}
		
		// Images
		$images = $this->get_product_images( $product );
		if ( ! empty( $images ) ) {
			$data['images'] = $images;
		}
		
		// Brand (if available via taxonomy or attribute)
		$brand = $this->get_product_brand( $product );
		if ( $brand ) {
			$data['brand'] = $brand;
		}
		
		// Shipping class
		$shipping_class = $product->get_shipping_class();
		if ( $shipping_class ) {
			$data['shipping_class'] = $shipping_class;
		}
		
		// Variation attributes (for variable products)
		if ( $product->is_type( 'variable' ) ) {
			$variation_attributes = $product->get_variation_attributes();
			if ( ! empty( $variation_attributes ) ) {
				$formatted_variation_attrs = array();
				foreach ( $variation_attributes as $attr_name => $values ) {
					$label = wc_attribute_label( $attr_name );
					$formatted_variation_attrs[] = $label;
				}
				$data['variation_attributes'] = $formatted_variation_attrs;
			}
		}
		
		return $data;
	}
	
	/**
	 * Get product summary (description or short description)
	 * 
	 * @param WC_Product $product Product object
	 * @return string Product summary
	 */
	private function get_product_summary( $product ) {
		// Try short description first
		$summary = $product->get_short_description();
		
		// Fall back to full description
		if ( empty( $summary ) ) {
			$summary = $product->get_description();
		}
		
		// Strip HTML tags and limit length
		$summary = wp_strip_all_tags( $summary );
		$summary = preg_replace( '/\s+/', ' ', $summary ); // Normalize whitespace
		$summary = trim( $summary );
		
		// Limit to 1000 characters for summary
		if ( strlen( $summary ) > 1000 ) {
			$summary = substr( $summary, 0, 997 ) . '...';
		}
		
		return $summary;
	}
	
	/**
	 * Get price range for product
	 * 
	 * @param WC_Product $product Product object
	 * @return array|null Price range data
	 */
	private function get_price_range( $product ) {
		$currency = get_woocommerce_currency();
		
		if ( $product->is_type( 'variable' ) ) {
			$min_price = $product->get_variation_price( 'min', true );
			$max_price = $product->get_variation_price( 'max', true );
			
			if ( $min_price !== '' && $max_price !== '' ) {
				return array(
					'min'      => (float) $min_price,
					'max'      => (float) $max_price,
					'currency' => $currency,
				);
			}
		}
		
		$price = $product->get_price();
		if ( $price !== '' ) {
			return array(
				'min'      => (float) $price,
				'max'      => (float) $price,
				'currency' => $currency,
			);
		}
		
		return null;
	}
	
	/**
	 * Get product images
	 * 
	 * @param WC_Product $product Product object
	 * @return array Image URLs
	 */
	private function get_product_images( $product ) {
		$images = array();
		
		// Main image
		$main_image_id = $product->get_image_id();
		if ( $main_image_id ) {
			$main_image_url = wp_get_attachment_image_url( $main_image_id, 'large' );
			if ( $main_image_url ) {
				$images[] = $main_image_url;
			}
		}
		
		// Gallery images (limit to 5 total)
		$gallery_ids = $product->get_gallery_image_ids();
		foreach ( $gallery_ids as $gallery_id ) {
			if ( count( $images ) >= 5 ) {
				break;
			}
			$gallery_url = wp_get_attachment_image_url( $gallery_id, 'large' );
			if ( $gallery_url ) {
				$images[] = $gallery_url;
			}
		}
		
		return $images;
	}
	
	/**
	 * Get product brand
	 * 
	 * @param WC_Product $product Product object
	 * @return string|null Brand name
	 */
	private function get_product_brand( $product ) {
		// Check common brand taxonomies
		$brand_taxonomies = array( 'product_brand', 'pa_brand', 'brand' );
		
		foreach ( $brand_taxonomies as $taxonomy ) {
			if ( taxonomy_exists( $taxonomy ) ) {
				$terms = wp_get_post_terms( $product->get_id(), $taxonomy, array( 'fields' => 'names' ) );
				if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) {
					return $terms[0];
				}
			}
		}
		
		// Check for brand attribute
		$attributes = $product->get_attributes();
		foreach ( $attributes as $attribute ) {
			$attr_name = strtolower( $attribute->get_name() );
			if ( strpos( $attr_name, 'brand' ) !== false || strpos( $attr_name, 'marka' ) !== false ) {
				if ( $attribute->is_taxonomy() ) {
					$values = wc_get_product_terms( $product->get_id(), $attribute->get_name(), array( 'fields' => 'names' ) );
				} else {
					$values = $attribute->get_options();
				}
				if ( ! empty( $values ) ) {
					return is_array( $values ) ? $values[0] : $values;
				}
			}
		}
		
		return null;
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
