<?php
/**
 * Plugin Name: AI Woo Chat
 * Plugin URI: https://aiwoochat.com
 * Description: AI-powered chat assistant for WooCommerce stores with knowledge base integration.
 * Version: 1.0.0
 * Author: AI Woo Chat
 * Author URI: https://aiwoochat.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: ai-woo-chat
 * Domain Path: /languages
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * WC requires at least: 7.0
 * WC tested up to: 8.0
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Define plugin constants
define( 'AI_WOO_CHAT_VERSION', '1.0.0' );
define( 'AI_WOO_CHAT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'AI_WOO_CHAT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'AI_WOO_CHAT_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

// Define SaaS platform URL (should be configurable later)
// Allow override from wp-config.php
if ( ! defined( 'AI_WOO_CHAT_SAAS_URL' ) ) {
	define( 'AI_WOO_CHAT_SAAS_URL', 'https://api.aiwoochat.com' );
}

/**
 * Main plugin class
 */
class AI_Woo_Chat {
	
	/**
	 * Single instance of the plugin
	 *
	 * @var AI_Woo_Chat
	 */
	private static $instance = null;
	
	/**
	 * Get singleton instance
	 *
	 * @return AI_Woo_Chat
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
	 * Initialize plugin
	 */
	private function init() {
		// Load dependencies
		$this->load_dependencies();
		
		// Initialize components
		$this->init_components();
		
		// Register hooks
		$this->register_hooks();
	}
	
	/**
	 * Load plugin dependencies
	 */
	private function load_dependencies() {
		require_once AI_WOO_CHAT_PLUGIN_DIR . 'includes/class-ai-woo-chat-options.php';
		require_once AI_WOO_CHAT_PLUGIN_DIR . 'includes/class-ai-woo-chat-license.php';
		require_once AI_WOO_CHAT_PLUGIN_DIR . 'includes/class-ai-woo-chat-hmac.php';
		require_once AI_WOO_CHAT_PLUGIN_DIR . 'includes/class-ai-woo-chat-hmac-signer.php';
		require_once AI_WOO_CHAT_PLUGIN_DIR . 'includes/class-ai-woo-chat-rest-api.php';
		require_once AI_WOO_CHAT_PLUGIN_DIR . 'includes/class-ai-woo-chat-admin.php';
		require_once AI_WOO_CHAT_PLUGIN_DIR . 'includes/class-ai-woo-chat-frontend.php';
		require_once AI_WOO_CHAT_PLUGIN_DIR . 'includes/class-ai-woo-chat-ingestion.php';
	}
	
	/**
	 * Initialize components
	 */
	private function init_components() {
		// Initialize REST API (always, for endpoints)
		AI_Woo_Chat_REST_API::get_instance();
		
		// Initialize admin if in admin area
		if ( is_admin() ) {
			AI_Woo_Chat_Admin::get_instance();
		}
		
		// Initialize frontend
		AI_Woo_Chat_Frontend::get_instance();
		
		// Initialize ingestion webhooks (only if activated)
		// Delay initialization until after plugins_loaded to ensure WooCommerce is ready
		add_action( 'plugins_loaded', array( $this, 'init_ingestion' ), 20 );
	}
	
	/**
	 * Register WordPress hooks
	 */
	private function register_hooks() {
		// Activation/Deactivation hooks
		register_activation_hook( __FILE__, array( $this, 'activate' ) );
		register_deactivation_hook( __FILE__, array( $this, 'deactivate' ) );
		
		// Load text domain
		add_action( 'plugins_loaded', array( $this, 'load_textdomain' ) );
		
		// Declare WooCommerce compatibility
		add_action( 'before_woocommerce_init', array( $this, 'declare_woocommerce_compatibility' ) );
	}
	
	/**
	 * Declare WooCommerce compatibility
	 */
	public function declare_woocommerce_compatibility() {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', __FILE__, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_product_tables', __FILE__, true );
		}
	}
	
	/**
	 * Plugin activation
	 */
	public function activate() {
		// Set default options if needed
		$options = AI_Woo_Chat_Options::get_instance();
		$options->maybe_set_defaults();
		
		// Check if WooCommerce is active
		if ( ! class_exists( 'WooCommerce' ) ) {
			deactivate_plugins( plugin_basename( __FILE__ ) );
			wp_die(
				esc_html__( 'AI Woo Chat requires WooCommerce to be installed and active.', 'ai-woo-chat' ),
				esc_html__( 'Plugin Activation Error', 'ai-woo-chat' ),
				array( 'back_link' => true )
			);
		}
		
		// Set initial status
		if ( ! $options->is_activated() ) {
			$options->set_status( 'inactive' );
		}
		
		// Note: REST API endpoints don't require rewrite rules flush
		// They are registered via register_rest_route() and work immediately
		
		// Set activation flag (for first-time activation notice)
		set_transient( 'ai_woo_chat_activation_notice', true, 60 );
	}
	
	/**
	 * Plugin deactivation
	 */
	public function deactivate() {
		// Clean up transients (but keep activation data for reactivation)
		delete_transient( 'ai_woo_chat_activation_notice' );
		
		// Note: We intentionally keep site_id and site_secret in options
		// so that reactivation doesn't require re-pairing
		// 
		// IMPORTANT: Deactivation only removes local pairing.
		// It does NOT call SaaS detach endpoint (this will be implemented
		// when detach/promote endpoints are available in To-Do #8).
		// Site remains paired on SaaS side until explicitly detached via dashboard.
		
		// Note: REST API endpoints don't require rewrite rules flush
	}
	
	/**
	 * Load plugin text domain
	 */
	public function load_textdomain() {
		load_plugin_textdomain(
			'ai-woo-chat',
			false,
			dirname( AI_WOO_CHAT_PLUGIN_BASENAME ) . '/languages'
		);
	}
	
	/**
	 * Initialize ingestion webhooks after plugins are loaded
	 * This ensures WooCommerce is available before registering hooks
	 */
	public function init_ingestion() {
		AI_Woo_Chat_Ingestion::get_instance();
	}
}

/**
 * Initialize the plugin
 */
function ai_woo_chat_init() {
	return AI_Woo_Chat::get_instance();
}

// Start the plugin
ai_woo_chat_init();
