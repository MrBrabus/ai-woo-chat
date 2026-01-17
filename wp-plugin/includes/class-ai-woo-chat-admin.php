<?php
/**
 * Admin interface class
 *
 * Handles admin settings page and license activation UI.
 *
 * @package AI_Woo_Chat
 */

// Exit if accessed directly
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * AI_Woo_Chat_Admin class
 */
class AI_Woo_Chat_Admin {
	
	/**
	 * Single instance
	 *
	 * @var AI_Woo_Chat_Admin
	 */
	private static $instance = null;
	
	/**
	 * Menu slug
	 */
	const MENU_SLUG = 'ai-woo-chat';
	
	/**
	 * Get singleton instance
	 *
	 * @return AI_Woo_Chat_Admin
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
	 * Initialize admin
	 */
	private function init() {
		// Add admin menu
		add_action( 'admin_menu', array( $this, 'add_admin_menu' ) );
		
		// Register settings
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		
		// Handle license activation AJAX
		add_action( 'wp_ajax_ai_woo_chat_activate_license', array( $this, 'handle_activate_license' ) );
		
		// Enqueue admin scripts
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
		
		// Show activation notice
		add_action( 'admin_notices', array( $this, 'show_activation_notice' ) );
	}
	
	/**
	 * Add admin menu
	 */
	public function add_admin_menu() {
		add_menu_page(
			__( 'AI Woo Chat', 'ai-woo-chat' ),
			__( 'AI Woo Chat', 'ai-woo-chat' ),
			'manage_options',
			self::MENU_SLUG,
			array( $this, 'render_settings_page' ),
			'dashicons-format-chat',
			56
		);
	}
	
	/**
	 * Register settings
	 */
	public function register_settings() {
		register_setting(
			AI_Woo_Chat_Options::OPTION_GROUP,
			AI_Woo_Chat_Options::OPTION_LICENSE_KEY,
			array(
				'sanitize_callback' => 'sanitize_text_field',
			)
		);
		
		register_setting(
			AI_Woo_Chat_Options::OPTION_GROUP,
			AI_Woo_Chat_Options::OPTION_SAAS_URL,
			array(
				'sanitize_callback' => 'esc_url_raw',
			)
		);
	}
	
	/**
	 * Render settings page
	 */
	public function render_settings_page() {
		$options = AI_Woo_Chat_Options::get_instance();
		$is_activated = $options->is_activated();
		$site_id = $options->get_site_id();
		$license_key = $options->get_license_key();
		$status = $options->get_status();
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			
			<div id="ai-woo-chat-admin-app">
				<?php
				// Show any stored error messages
				$activation_error = get_transient( 'ai_woo_chat_activation_error' );
				if ( $activation_error ) {
					delete_transient( 'ai_woo_chat_activation_error' );
					?>
					<div class="notice notice-error">
						<p><strong><?php esc_html_e( 'Activation Error:', 'ai-woo-chat' ); ?></strong> <?php echo esc_html( $activation_error ); ?></p>
					</div>
					<?php
				}
				?>
				
				<?php if ( $is_activated ) : ?>
					<div class="notice notice-success">
						<p>
							<strong><?php esc_html_e( '✓ Plugin is activated and connected!', 'ai-woo-chat' ); ?></strong>
						</p>
					</div>
					
					<div class="card" style="max-width: 600px; margin-top: 20px;">
						<h2 style="margin-top: 0;"><?php esc_html_e( 'Activation Details', 'ai-woo-chat' ); ?></h2>
						<table class="form-table">
							<tr>
								<th scope="row"><?php esc_html_e( 'Site ID', 'ai-woo-chat' ); ?></th>
								<td>
									<code style="font-size: 12px;"><?php echo esc_html( $site_id ); ?></code>
									<button type="button" class="button button-small" onclick="navigator.clipboard.writeText('<?php echo esc_js( $site_id ); ?>'); this.textContent='<?php esc_attr_e( 'Copied!', 'ai-woo-chat' ); ?>';">
										<?php esc_html_e( 'Copy', 'ai-woo-chat' ); ?>
									</button>
								</td>
							</tr>
							<tr>
								<th scope="row"><?php esc_html_e( 'Status', 'ai-woo-chat' ); ?></th>
								<td>
									<strong style="color: #46b450;"><?php echo esc_html( ucfirst( $status ) ); ?></strong>
								</td>
							</tr>
							<tr>
								<th scope="row"><?php esc_html_e( 'License Key', 'ai-woo-chat' ); ?></th>
								<td>
									<code style="font-size: 12px;"><?php echo esc_html( $license_key ? substr( $license_key, 0, 8 ) . '...' : 'N/A' ); ?></code>
								</td>
							</tr>
							<tr>
								<th scope="row"><?php esc_html_e( 'SaaS Platform', 'ai-woo-chat' ); ?></th>
								<td>
									<a href="<?php echo esc_url( $options->get_saas_url() ); ?>" target="_blank">
										<?php echo esc_html( $options->get_saas_url() ); ?>
									</a>
								</td>
							</tr>
						</table>
					</div>
					
					<div style="margin-top: 20px;">
						<form method="post" action="" style="display: inline-block;">
							<?php wp_nonce_field( 'ai_woo_chat_deactivate', 'ai_woo_chat_nonce' ); ?>
							<input type="hidden" name="action" value="deactivate" />
							<button type="submit" class="button button-secondary" onclick="return confirm('<?php esc_attr_e( 'Are you sure you want to deactivate? This will disconnect your site from the SaaS platform. You can reactivate later with the same license key.', 'ai-woo-chat' ); ?>');">
								<?php esc_html_e( 'Deactivate License', 'ai-woo-chat' ); ?>
							</button>
						</form>
						<p class="description" style="margin-top: 10px;">
							<?php esc_html_e( 'Deactivating will disconnect your site but keep your license key for easy reactivation.', 'ai-woo-chat' ); ?>
						</p>
					</div>
				<?php else : ?>
					<div class="notice notice-warning">
						<p>
							<strong><?php esc_html_e( 'Plugin is not activated.', 'ai-woo-chat' ); ?></strong>
							<?php esc_html_e( 'Please enter your license key to activate and connect your site to the AI Woo Chat platform.', 'ai-woo-chat' ); ?>
						</p>
					</div>
					
					<?php if ( ! empty( $license_key ) ) : ?>
						<div class="notice notice-info">
							<p>
								<?php esc_html_e( 'You have a saved license key. Click "Activate License" to connect your site.', 'ai-woo-chat' ); ?>
							</p>
						</div>
					<?php endif; ?>
					
					<form id="ai-woo-chat-activate-form" method="post">
						<?php wp_nonce_field( 'ai_woo_chat_activate', 'ai_woo_chat_nonce' ); ?>
						
						<table class="form-table">
							<tr>
								<th scope="row">
									<label for="saas_url">
										<?php esc_html_e( 'SaaS Platform URL', 'ai-woo-chat' ); ?>
									</label>
								</th>
								<td>
									<input 
										type="url" 
										id="saas_url" 
										name="saas_url" 
										class="regular-text" 
										value="<?php echo esc_attr( $options->get_saas_url() ); ?>"
										placeholder="https://api.aiwoochat.com"
									/>
									<p class="description">
										<?php esc_html_e( 'Enter the SaaS platform URL (e.g., https://api.aiwoochat.com). Leave empty to use default.', 'ai-woo-chat' ); ?>
									</p>
								</td>
							</tr>
							<tr>
								<th scope="row">
									<label for="license_key">
										<?php esc_html_e( 'License Key', 'ai-woo-chat' ); ?>
									</label>
								</th>
								<td>
									<input 
										type="text" 
										id="license_key" 
										name="license_key" 
										class="regular-text" 
										value=""
										placeholder="<?php echo esc_attr( $license_key ? substr( $license_key, 0, 8 ) . '...' : 'abc123-def456-ghi789' ); ?>"
										required
									/>
									<?php if ( ! empty( $license_key ) ) : ?>
										<input type="hidden" name="has_saved_key" value="1" />
										<p class="description" style="color: #2271b1; margin-top: 5px;">
											<?php esc_html_e( 'Saved license key detected. Leave empty to use saved key, or enter a new one to replace it.', 'ai-woo-chat' ); ?>
										</p>
									<?php endif; ?>
									<p class="description">
										<?php esc_html_e( 'Enter your license key to activate the plugin. You can find your license key in your AI Woo Chat account dashboard.', 'ai-woo-chat' ); ?>
									</p>
								</td>
							</tr>
						</table>
						
						<p class="submit">
							<button type="submit" class="button button-primary" id="activate-license-btn">
								<?php esc_html_e( 'Activate License', 'ai-woo-chat' ); ?>
							</button>
							<span class="spinner" id="activation-spinner" style="float: none; margin-left: 10px;"></span>
						</p>
						
						<div id="activation-message" style="margin-top: 15px;"></div>
					</form>
				<?php endif; ?>
			</div>
		</div>
		<?php
		
		// Handle form submission (non-AJAX fallback)
		$this->handle_form_submission();
	}
	
	/**
	 * Handle form submission (non-AJAX fallback)
	 */
	private function handle_form_submission() {
		if ( ! isset( $_POST['ai_woo_chat_nonce'] ) ) {
			return;
		}
		
		// Verify nonce
		if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['ai_woo_chat_nonce'] ) ), 'ai_woo_chat_activate' ) 
			&& ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['ai_woo_chat_nonce'] ) ), 'ai_woo_chat_deactivate' ) ) {
			return;
		}
		
		// Handle deactivation
		if ( isset( $_POST['action'] ) && 'deactivate' === $_POST['action'] ) {
			$license = AI_Woo_Chat_License::get_instance();
			$result = $license->deactivate();
			
			if ( is_wp_error( $result ) ) {
				echo '<div class="notice notice-error"><p><strong>' . esc_html__( 'Deactivation failed:', 'ai-woo-chat' ) . '</strong> ' . esc_html( $result->get_error_message() ) . '</p></div>';
			} else {
				echo '<div class="notice notice-success"><p>' . esc_html__( 'License deactivated. Your site is now disconnected from the AI Woo Chat platform. You can reactivate at any time with the same license key.', 'ai-woo-chat' ) . '</p></div>';
			}
			return;
		}
		
		// Handle SaaS URL update - MUST be before activation
		if ( isset( $_POST['saas_url'] ) ) {
			$saas_url = sanitize_text_field( wp_unslash( $_POST['saas_url'] ) );
			if ( ! empty( $saas_url ) ) {
				// Remove trailing slash if present
				$saas_url = rtrim( $saas_url, '/' );
				$options->set_saas_url( $saas_url );
				// Force refresh options instance to use new URL
				$options = AI_Woo_Chat_Options::get_instance();
			}
		}
		
		// Handle activation
		if ( isset( $_POST['license_key'] ) || isset( $_POST['has_saved_key'] ) ) {
			$license_key = isset( $_POST['license_key'] ) ? sanitize_text_field( wp_unslash( $_POST['license_key'] ) ) : '';
			
			// If empty but has saved key, use saved key
			if ( empty( $license_key ) && isset( $_POST['has_saved_key'] ) ) {
				$options = AI_Woo_Chat_Options::get_instance();
				$license_key = $options->get_license_key();
			}
			
			if ( ! empty( $license_key ) ) {
				$license = AI_Woo_Chat_License::get_instance();
				$result = $license->activate( $license_key );
				
				if ( is_wp_error( $result ) ) {
					$error_code = $result->get_error_code();
					$error_message = $result->get_error_message();
					
					// Store error for display
					set_transient( 'ai_woo_chat_activation_error', $error_message, 60 );
					
					// Set error status
					$options->set_status( 'error' );
					
					echo '<div class="notice notice-error"><p><strong>' . esc_html__( 'Activation failed:', 'ai-woo-chat' ) . '</strong> ' . esc_html( $error_message ) . '</p></div>';
					
					// Show helpful messages for common errors
					if ( 'LICENSE_NOT_FOUND' === $error_code ) {
						echo '<div class="notice notice-info"><p>' . esc_html__( 'Please verify your license key is correct. You can find it in your AI Woo Chat account dashboard.', 'ai-woo-chat' ) . '</p></div>';
					} elseif ( 'LICENSE_REVOKED' === $error_code || 'LICENSE_EXPIRED' === $error_code ) {
						echo '<div class="notice notice-warning"><p>' . esc_html__( 'Your license is not active. Please contact support or renew your license.', 'ai-woo-chat' ) . '</p></div>';
					}
				} else {
					echo '<div class="notice notice-success"><p><strong>' . esc_html__( 'License activated successfully!', 'ai-woo-chat' ) . '</strong></p></div>';
					echo '<div class="notice notice-info"><p>' . esc_html__( 'Your site is now connected to the AI Woo Chat platform. The chat widget will appear on your storefront.', 'ai-woo-chat' ) . '</p></div>';
				}
			}
		}
	}
	
	/**
	 * Handle license activation via AJAX
	 */
	public function handle_activate_license() {
		// Verify nonce
		check_ajax_referer( 'ai_woo_chat_activate', 'nonce' );
		
		// Check permissions
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array(
				'message' => __( 'Insufficient permissions', 'ai-woo-chat' ),
			) );
		}
		
		$options = AI_Woo_Chat_Options::get_instance();
		
		// Handle SaaS URL update - MUST be before activation
		if ( isset( $_POST['saas_url'] ) ) {
			$saas_url = sanitize_text_field( wp_unslash( $_POST['saas_url'] ) );
			if ( ! empty( $saas_url ) ) {
				// Remove trailing slash if present
				$saas_url = rtrim( $saas_url, '/' );
				$options->set_saas_url( $saas_url );
				// Force refresh options instance to use new URL
				$options = AI_Woo_Chat_Options::get_instance();
			}
		}
		
		// Get license key
		$license_key = isset( $_POST['license_key'] ) ? sanitize_text_field( wp_unslash( $_POST['license_key'] ) ) : '';
		
		// If empty but has saved key, use saved key
		if ( empty( $license_key ) && isset( $_POST['has_saved_key'] ) ) {
			$license_key = $options->get_license_key();
		}
		
		if ( empty( $license_key ) ) {
			wp_send_json_error( array(
				'message' => __( 'License key is required', 'ai-woo-chat' ),
			) );
		}
		
		// Activate license
		$license = AI_Woo_Chat_License::get_instance();
		$result = $license->activate( $license_key );
		
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array(
				'message' => $result->get_error_message(),
				'code'    => $result->get_error_code(),
			) );
		}
		
		wp_send_json_success( array(
			'message' => __( 'License activated successfully!', 'ai-woo-chat' ),
			'data'    => $result,
		) );
	}
	
	/**
	 * Enqueue admin scripts
	 *
	 * @param string $hook Current admin page hook
	 */
	public function enqueue_scripts( $hook ) {
		// Only load on our settings page
		if ( 'toplevel_page_' . self::MENU_SLUG !== $hook ) {
			return;
		}
		
		wp_enqueue_script(
			'ai-woo-chat-admin',
			AI_WOO_CHAT_PLUGIN_URL . 'assets/js/admin.js',
			array( 'jquery' ),
			AI_WOO_CHAT_VERSION,
			true
		);
		
		wp_localize_script(
			'ai-woo-chat-admin',
			'aiWooChatAdmin',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'ai_woo_chat_activate' ),
				'strings' => array(
					'activating' => __( 'Activating...', 'ai-woo-chat' ),
					'success'    => __( 'License activated successfully!', 'ai-woo-chat' ),
					'error'      => __( 'Activation failed. Please try again.', 'ai-woo-chat' ),
				),
			)
		);
		
		wp_enqueue_style(
			'ai-woo-chat-admin',
			AI_WOO_CHAT_PLUGIN_URL . 'assets/css/admin.css',
			array(),
			AI_WOO_CHAT_VERSION
		);
	}
	
	/**
	 * Show activation notice on first activation
	 */
	public function show_activation_notice() {
		// Only show on our settings page
		$screen = get_current_screen();
		if ( ! $screen || 'toplevel_page_' . self::MENU_SLUG !== $screen->id ) {
			return;
		}
		
		// Check if this is first activation
		if ( get_transient( 'ai_woo_chat_activation_notice' ) ) {
			delete_transient( 'ai_woo_chat_activation_notice' );
			
			$options = AI_Woo_Chat_Options::get_instance();
			if ( ! $options->is_activated() ) {
				?>
				<div class="notice notice-info is-dismissible">
					<p>
						<strong><?php esc_html_e( 'Welcome to AI Woo Chat!', 'ai-woo-chat' ); ?></strong>
					</p>
					<p>
						<?php esc_html_e( 'To get started, please enter your license key below to activate the plugin and connect your site to the AI Woo Chat platform.', 'ai-woo-chat' ); ?>
					</p>
				</div>
				<?php
			}
		}
	}
}
