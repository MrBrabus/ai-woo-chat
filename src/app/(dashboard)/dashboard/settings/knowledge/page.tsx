/**
 * Knowledge Settings Page
 * 
 * Configure knowledge base and content sources
 */

'use client';

import { useState, useEffect } from 'react';

export default function KnowledgeSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    include_products: true,
    include_pages: true,
    include_policies: true,
    include_faq: false,
    auto_index_enabled: true,
    chunk_size: 1000,
    top_k_results: 5,
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
      const response = await fetch(`/api/knowledge/settings?site_id=${siteId}`);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await response.json();
      setSettings({
        include_products: data.include_products ?? true,
        include_pages: data.include_pages ?? true,
        include_policies: data.include_policies ?? true,
        include_faq: data.include_faq ?? false,
        auto_index_enabled: data.auto_index_enabled ?? true,
        chunk_size: data.chunk_size ?? 1000,
        top_k_results: data.top_k_results ?? 5,
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
      const response = await fetch('/api/knowledge/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_id: siteId,
          include_products: settings.include_products,
          include_pages: settings.include_pages,
          include_policies: settings.include_policies,
          include_faq: settings.include_faq,
          auto_index_enabled: settings.auto_index_enabled,
          chunk_size: settings.chunk_size,
          top_k_results: settings.top_k_results,
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Knowledge Base Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Content Sources</h2>
          <div className="space-y-3">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.include_products}
                onChange={(e) =>
                  setSettings({ ...settings, include_products: e.target.checked })
                }
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-gray-900">Include Products</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.include_pages}
                onChange={(e) =>
                  setSettings({ ...settings, include_pages: e.target.checked })
                }
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-gray-900">Include Pages</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.include_policies}
                onChange={(e) =>
                  setSettings({ ...settings, include_policies: e.target.checked })
                }
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-gray-900">Include Policies (Shipping, Returns, etc.)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={settings.include_faq}
                onChange={(e) =>
                  setSettings({ ...settings, include_faq: e.target.checked })
                }
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-gray-900">Include FAQ</span>
            </label>
          </div>
        </div>

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.auto_index_enabled}
              onChange={(e) =>
                setSettings({ ...settings, auto_index_enabled: e.target.checked })
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium text-gray-900">Auto-Index Content Changes</span>
          </label>
          <p className="text-sm text-gray-600 mt-1 ml-6">
            Automatically update knowledge base when content changes
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Chunk Size (characters)</label>
          <input
            type="number"
            min="500"
            max="2000"
            step="100"
            value={settings.chunk_size}
            onChange={(e) =>
              setSettings({ ...settings, chunk_size: parseInt(e.target.value) || 1000 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-sm text-gray-600 mt-1">
            Size of text chunks for embedding (500-2000 characters)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">Top-K Results</label>
          <input
            type="number"
            min="1"
            max="20"
            value={settings.top_k_results}
            onChange={(e) =>
              setSettings({ ...settings, top_k_results: parseInt(e.target.value) || 5 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-sm text-gray-600 mt-1">
            Number of relevant chunks to retrieve per query (1-20)
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
