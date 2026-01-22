/**
 * Sales Settings Page
 * 
 * Configure sales playbook and conversion settings
 */

'use client';

import { useState, useEffect } from 'react';

export default function SalesSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    enable_product_recommendations: true,
    max_recommendations: 3,
    upsell_enabled: false,
    cross_sell_enabled: true,
    urgency_messages: false,
    urgency_stock_threshold: 5,
    discount_prompts: false,
    bundle_suggestions: false,
    social_proof_enabled: true,
    price_mentions: 'when_relevant',
    call_to_action_style: 'friendly',
    free_shipping_threshold: null as number | null,
    return_policy_mentions: false,
    payment_options_mentions: false,
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('site_id');
    setSiteId(id);

    if (id) {
      loadSettings(id);
    }
  }, []);

  const loadSettings = async (siteId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/sales/settings?site_id=${siteId}`);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await response.json();
      setSettings({
        enable_product_recommendations: data.enable_product_recommendations ?? true,
        max_recommendations: data.max_recommendations ?? 3,
        upsell_enabled: data.upsell_enabled ?? false,
        cross_sell_enabled: data.cross_sell_enabled ?? true,
        urgency_messages: data.urgency_messages ?? false,
        urgency_stock_threshold: data.urgency_stock_threshold ?? 5,
        discount_prompts: data.discount_prompts ?? false,
        bundle_suggestions: data.bundle_suggestions ?? false,
        social_proof_enabled: data.social_proof_enabled !== false,
        price_mentions: data.price_mentions || 'when_relevant',
        call_to_action_style: data.call_to_action_style || 'friendly',
        free_shipping_threshold: data.free_shipping_threshold ?? null,
        return_policy_mentions: data.return_policy_mentions ?? false,
        payment_options_mentions: data.payment_options_mentions ?? false,
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!siteId) {
      alert('Site ID is required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/sales/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_id: siteId,
          enable_product_recommendations: settings.enable_product_recommendations,
          max_recommendations: settings.max_recommendations,
          upsell_enabled: settings.upsell_enabled,
          cross_sell_enabled: settings.cross_sell_enabled,
          urgency_messages: settings.urgency_messages,
          urgency_stock_threshold: settings.urgency_stock_threshold,
          discount_prompts: settings.discount_prompts,
          bundle_suggestions: settings.bundle_suggestions,
          social_proof_enabled: settings.social_proof_enabled,
          price_mentions: settings.price_mentions,
          call_to_action_style: settings.call_to_action_style,
          free_shipping_threshold: settings.free_shipping_threshold,
          return_policy_mentions: settings.return_policy_mentions,
          payment_options_mentions: settings.payment_options_mentions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to save settings');
      }

      alert('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Sales Settings</h1>
      <p className="text-gray-600 mb-6">
        Configure how the AI assistant handles sales, recommendations, and conversion optimization.
      </p>

      <div className="bg-white rounded-lg shadow p-6 space-y-8">
        {/* Product Recommendations Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Recommendations</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.enable_product_recommendations}
                  onChange={(e) =>
                    setSettings({ ...settings, enable_product_recommendations: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-900">Enable Product Recommendations</span>
              </label>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Allow AI to proactively recommend products when relevant
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Max Recommendations per Message
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.max_recommendations}
                onChange={(e) =>
                  setSettings({ ...settings, max_recommendations: parseInt(e.target.value) || 3 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!settings.enable_product_recommendations}
              />
              <p className="text-sm text-gray-600 mt-1">
                Maximum number of products to recommend in a single response (1-10)
              </p>
            </div>
          </div>
        </div>

        {/* Upsell & Cross-sell Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upsell & Cross-sell</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.upsell_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, upsell_enabled: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-900">Enable Upsell Suggestions</span>
              </label>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Suggest higher-value alternatives or upgrades when relevant
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.cross_sell_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, cross_sell_enabled: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-900">Enable Cross-sell Suggestions</span>
              </label>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Suggest complementary products that work well together
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.bundle_suggestions}
                  onChange={(e) =>
                    setSettings({ ...settings, bundle_suggestions: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-900">Enable Bundle Suggestions</span>
              </label>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Suggest product bundles or grouped products when available
              </p>
            </div>
          </div>
        </div>

        {/* Urgency & Scarcity Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Urgency & Scarcity</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.urgency_messages}
                  onChange={(e) =>
                    setSettings({ ...settings, urgency_messages: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-900">Enable Urgency Messages</span>
              </label>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Show stock availability messages to create urgency
              </p>
            </div>

            {settings.urgency_messages && (
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Stock Threshold for Urgency Messages
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.urgency_stock_threshold}
                  onChange={(e) =>
                    setSettings({ ...settings, urgency_stock_threshold: parseInt(e.target.value) || 5 })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                <p className="text-sm text-gray-600 mt-1">
                  Show urgency message when stock is at or below this number (e.g., "Only 5 left in stock")
                </p>
              </div>
            )}

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.discount_prompts}
                  onChange={(e) =>
                    setSettings({ ...settings, discount_prompts: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-900">Enable Discount Prompts</span>
              </label>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Mention discounts, promotions, or special offers when available and relevant
              </p>
            </div>
          </div>
        </div>

        {/* Social Proof Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Social Proof</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.social_proof_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, social_proof_enabled: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-900">Enable Social Proof Mentions</span>
              </label>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Mention customer reviews, ratings, or popularity when available (e.g., "Rated 4.8/5 by 200+ customers")
              </p>
            </div>
          </div>
        </div>

        {/* Pricing & Value Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pricing & Value</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                When to Mention Prices
              </label>
              <select
                value={settings.price_mentions}
                onChange={(e) =>
                  setSettings({ ...settings, price_mentions: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="always">Always - Include price in all product mentions</option>
                <option value="when_relevant">When Relevant - Mention price when it adds value</option>
                <option value="on_request">On Request - Only mention price when customer asks</option>
              </select>
              <p className="text-sm text-gray-600 mt-1">
                Control how frequently the AI mentions product prices
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Free Shipping Threshold (optional)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.free_shipping_threshold || ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    free_shipping_threshold: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="e.g., 50.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                If set, AI will mention free shipping when cart value reaches this amount (leave empty to disable)
              </p>
            </div>
          </div>
        </div>

        {/* Call-to-Action Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Call-to-Action Style</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                CTA Style
              </label>
              <select
                value={settings.call_to_action_style}
                onChange={(e) =>
                  setSettings({ ...settings, call_to_action_style: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="friendly">Friendly - "Check it out", "Take a look"</option>
                <option value="direct">Direct - "Buy now", "Add to cart"</option>
                <option value="subtle">Subtle - "Learn more", "View details"</option>
                <option value="enthusiastic">Enthusiastic - "Don't miss out!", "Get yours today!"</option>
              </select>
              <p className="text-sm text-gray-600 mt-1">
                Control the tone of call-to-action phrases in product recommendations
              </p>
            </div>
          </div>
        </div>

        {/* Policy & Trust Section */}
        <div className="pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Policy & Trust</h2>
          <div className="space-y-4">
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.return_policy_mentions}
                  onChange={(e) =>
                    setSettings({ ...settings, return_policy_mentions: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-900">Mention Return Policy</span>
              </label>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Proactively mention return/refund policy to build trust (e.g., "30-day money-back guarantee")
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.payment_options_mentions}
                  onChange={(e) =>
                    setSettings({ ...settings, payment_options_mentions: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium text-gray-900">Mention Payment Options</span>
              </label>
              <p className="text-sm text-gray-600 mt-1 ml-6">
                Mention available payment methods or installment options when relevant
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-6 border-t">
          <button
            onClick={handleSave}
            disabled={saving || !siteId}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
