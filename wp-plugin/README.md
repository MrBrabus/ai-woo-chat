# AI Woo Chat WordPress Plugin

WordPress/WooCommerce plugin for AI Woo Chat SaaS platform.

## Installation

1. Upload the `ai-woo-chat` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Navigate to **AI Woo Chat** in the admin menu
4. Enter your license key and activate

## Features

- License activation with SaaS platform
- Secure storage of site credentials
- HMAC-signed communication with SaaS platform
- Frontend widget loader for chat interface
- Admin settings page

## Requirements

- WordPress 6.0+
- PHP 7.4+
- WooCommerce 7.0+ (tested up to 8.0)

## Development

This is a skeleton plugin. Future development will include:
- Product/content REST endpoints
- Webhook ingestion system
- Order status endpoints
- Full HMAC middleware implementation

## Security

- Site ID and site secret stored securely in WordPress options
- HMAC-SHA256 signing for all SaaS communications
- Nonce and timestamp validation
- Proper capability checks for admin functions
