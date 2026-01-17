<?php
/**
 * Options management class
 *
 * Handles secure storage and retrieval of plugin options including
 * site_id and site_secret.
 *
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI_Woo_Chat_Options class
 */
class AI_Woo_Chat_Options {
	
	/**
	 * Single instance
	 *
	 * @var AI_Woo_Chat_Options
	 */
	private static $instance = null;
	
	/**
	 * Option names
	 */
	const OPTION_GROUP = 'ai_woo_chat_settings';
	const OPTION_SITE_ID = 'ai_woo_chat_site_id';
	const OPTION_SITE_SECRET = 'ai_woo_chat_site_secret';
	const OPTION_LICENSE_KEY = 'ai_woo_chat_license_key';
	const OPTION_SAAS_URL = 'ai_woo_chat_saas_url';
	const OPTION_STATUS = 'ai_woo_chat_status';
	
	/**
	 * Get singleton instance
	 *
	 * @return AI_Woo_Chat_Options
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
	 * Get site ID
	 *
	 * @return string|null
	 */
	public function get_site_id() {
		return get_option( self::OPTION_SITE_ID, null );
	}
	
	/**
	 * Get site secret
	 *
	 * @return string|null
	 */
	public function get_site_secret() {
		$secret = get_option( self::OPTION_SITE_SECRET, null );
		
		// Decrypt if encrypted (for future enhancement)
		// For now, store as-is but consider encryption in production
		return $secret;
	}
	
	/**
	 * Set site ID
	 *
	 * @param string $site_id Site ID from SaaS platform (UUID format)
	 * @return bool
	 */
	public function set_site_id( $site_id ) {
		// Validate UUID format
		if ( ! empty( $site_id ) && ! preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $site_id ) ) {
			return false;
		}
		
		return update_option( self::OPTION_SITE_ID, sanitize_text_field( $site_id ), false );
	}
	
	/**
	 * Set site secret
	 *
	 * @param string $site_secret Site secret from SaaS platform
	 * @return bool
	 */
	public function set_site_secret( $site_secret ) {
		// Validate format (should start with 'sec_')
		if ( ! empty( $site_secret ) && ! preg_match( '/^sec_[a-f0-9]{64}$/', $site_secret ) ) {
			return false;
		}
		
		// Store securely
		// TODO: Consider encryption for production
		return update_option( self::OPTION_SITE_SECRET, sanitize_text_field( $site_secret ), false );
	}
	
	/**
	 * Get license key
	 *
	 * @return string|null
	 */
	public function get_license_key() {
		return get_option( self::OPTION_LICENSE_KEY, null );
	}
	
	/**
	 * Set license key
	 *
	 * @param string $license_key License key
	 * @return bool
	 */
	public function set_license_key( $license_key ) {
		return update_option( self::OPTION_LICENSE_KEY, sanitize_text_field( $license_key ), false );
	}
	
	/**
	 * Get SaaS URL
	 *
	 * @return string
	 */
	public function get_saas_url() {
		// Priority order:
		// 1. Database option (user-set value)
		// 2. wp-config.php constant (if defined)
		// 3. Plugin default
		
		$url = get_option( self::OPTION_SAAS_URL, null );
		
		// If no database option, check for constant
		if ( empty( $url ) ) {
			if ( defined( 'AI_WOO_CHAT_SAAS_URL' ) ) {
				$url = AI_WOO_CHAT_SAAS_URL;
			} else {
				$url = 'https://api.aiwoochat.com';
			}
		}
		
		// Remove trailing slash for consistency (we add it when needed)
		$url = rtrim( $url, '/' );
		
		// Debug logging (remove in production)
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			error_log( 'AI Woo Chat: get_saas_url() returning: ' . $url );
			error_log( 'AI Woo Chat: Database option: ' . get_option( self::OPTION_SAAS_URL, 'NOT SET' ) );
			error_log( 'AI Woo Chat: Constant defined: ' . ( defined( 'AI_WOO_CHAT_SAAS_URL' ) ? AI_WOO_CHAT_SAAS_URL : 'NOT DEFINED' ) );
		}
		
		return $url;
	}
	
	/**
	 * Set SaaS URL
	 *
	 * @param string $url SaaS platform URL
	 * @return bool
	 */
	public function set_saas_url( $url ) {
		// Remove trailing slash for consistency
		$url = rtrim( esc_url_raw( $url ), '/' );
		// Clear WordPress object cache for this option
		wp_cache_delete( self::OPTION_SAAS_URL, 'options' );
		return update_option( self::OPTION_SAAS_URL, $url, false );
	}
	
	/**
	 * Get activation status
	 *
	 * @return string 'active'|'inactive'|'error'
	 */
	public function get_status() {
		return get_option( self::OPTION_STATUS, 'inactive' );
	}
	
	/**
	 * Set activation status
	 *
	 * @param string $status Status
	 * @return bool
	 */
	public function set_status( $status ) {
		$allowed = array( 'active', 'inactive', 'error' );
		if ( ! in_array( $status, $allowed, true ) ) {
			return false;
		}
		return update_option( self::OPTION_STATUS, $status, false );
	}
	
	/**
	 * Check if plugin is activated
	 *
	 * @return bool
	 */
	public function is_activated() {
		$site_id = $this->get_site_id();
		$site_secret = $this->get_site_secret();
		return ! empty( $site_id ) && ! empty( $site_secret );
	}
	
	/**
	 * Clear all activation data
	 *
	 * @return void
	 */
	public function clear_activation() {
		delete_option( self::OPTION_SITE_ID );
		delete_option( self::OPTION_SITE_SECRET );
		delete_option( self::OPTION_STATUS );
		// Keep license key for re-activation
	}
	
	/**
	 * Set default options
	 *
	 * @return void
	 */
	public function maybe_set_defaults() {
		// Set default SaaS URL if not set
		if ( ! get_option( self::OPTION_SAAS_URL ) ) {
			$this->set_saas_url( defined( 'AI_WOO_CHAT_SAAS_URL' ) ? AI_WOO_CHAT_SAAS_URL : 'https://api.aiwoochat.com' );
		}
	}
}
