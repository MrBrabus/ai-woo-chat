/**
 * Admin JavaScript for AI Woo Chat
 */
(function($) {
	'use strict';
	
	$(document).ready(function() {
		var $form = $('#ai-woo-chat-activate-form');
		var $btn = $('#activate-license-btn');
		var $spinner = $('#activation-spinner');
		var $message = $('#activation-message');
		
		$form.on('submit', function(e) {
			e.preventDefault();
			
			var licenseKey = $('#license_key').val().trim();
			
			if (!licenseKey) {
				showMessage('error', 'Please enter a license key.');
				return;
			}
			
			// Show loading state
			$btn.prop('disabled', true);
			$spinner.addClass('is-active');
			$message.empty();
			
			// Make AJAX request
			$.ajax({
				url: aiWooChatAdmin.ajaxUrl,
				type: 'POST',
				data: {
					action: 'ai_woo_chat_activate_license',
					nonce: aiWooChatAdmin.nonce,
					license_key: licenseKey
				},
				success: function(response) {
					$spinner.removeClass('is-active');
					
					if (response.success) {
						showMessage('success', response.data.message || aiWooChatAdmin.strings.success);
						// Reload page after 2 seconds to show activated state
						setTimeout(function() {
							window.location.reload();
						}, 2000);
					} else {
						showMessage('error', response.data.message || aiWooChatAdmin.strings.error);
						$btn.prop('disabled', false);
					}
				},
				error: function() {
					$spinner.removeClass('is-active');
					showMessage('error', aiWooChatAdmin.strings.error);
					$btn.prop('disabled', false);
				}
			});
		});
		
		function showMessage(type, text) {
			var className = type === 'success' ? 'notice-success' : 'notice-error';
			$message.html(
				'<div class="notice ' + className + ' is-dismissible">' +
				'<p>' + text + '</p>' +
				'</div>'
			);
		}
	});
})(jQuery);
