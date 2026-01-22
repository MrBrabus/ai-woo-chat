/**
 * Voice Settings Page
 * 
 * Configure AI voice/personality settings
 */

'use client';

import { useState, useEffect } from 'react';

export default function VoiceSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    tone: 'friendly',
    style: 'professional',
    language: 'en',
    personality: '',
    response_length: 'medium',
    product_type_awareness: true,
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
      const response = await fetch(`/api/voice/settings?site_id=${siteId}`);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await response.json();
      setSettings({
        tone: data.tone || 'friendly',
        style: data.style || 'professional',
        language: data.language || 'en',
        personality: data.personality || '',
        response_length: data.response_length || 'medium',
        product_type_awareness: data.product_type_awareness !== false,
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
      const response = await fetch('/api/voice/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_id: siteId,
          tone: settings.tone,
          style: settings.style,
          language: settings.language,
          personality: settings.personality,
          response_length: settings.response_length,
          product_type_awareness: settings.product_type_awareness,
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Voice Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Tone</label>
          <select
            value={settings.tone}
            onChange={(e) => setSettings({ ...settings, tone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="formal">Formal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Style</label>
          <select
            value={settings.style}
            onChange={(e) => setSettings({ ...settings, style: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="professional">Professional</option>
            <option value="conversational">Conversational</option>
            <option value="helpful">Helpful</option>
            <option value="enthusiastic">Enthusiastic</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Language</label>
          <select
            value={settings.language}
            onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Personality</label>
          <textarea
            value={settings.personality}
            onChange={(e) => setSettings({ ...settings, personality: e.target.value })}
            placeholder="Describe the AI's personality traits (e.g., 'Be enthusiastic about new products', 'Use technical language when appropriate')..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            rows={4}
          />
          <p className="text-sm text-gray-600 mt-1">
            Additional personality traits or instructions for the AI assistant
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Response Length</label>
          <select
            value={settings.response_length}
            onChange={(e) => setSettings({ ...settings, response_length: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="short">Short - Brief and to the point</option>
            <option value="medium">Medium - Balanced with sufficient detail</option>
            <option value="detailed">Detailed - Comprehensive and thorough</option>
          </select>
          <p className="text-sm text-gray-600 mt-1">
            Control how detailed the AI responses should be
          </p>
        </div>

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.product_type_awareness}
              onChange={(e) =>
                setSettings({ ...settings, product_type_awareness: e.target.checked })
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium text-gray-900">WooCommerce Product Type Awareness</span>
          </label>
          <p className="text-sm text-gray-600 mt-1 ml-6">
            Enable AI to understand different product types (digital, physical, licenses, courses, subscriptions, etc.) and tailor responses accordingly
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
