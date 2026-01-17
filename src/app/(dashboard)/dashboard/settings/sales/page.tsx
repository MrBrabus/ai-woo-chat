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
    discount_prompts: false,
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
        discount_prompts: data.discount_prompts ?? false,
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
          discount_prompts: settings.discount_prompts,
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

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
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
        </div>

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
        </div>

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
            Show messages like "Only 2 left in stock"
          </p>
        </div>

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
            Suggest discounts or promotions when appropriate
          </p>
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
