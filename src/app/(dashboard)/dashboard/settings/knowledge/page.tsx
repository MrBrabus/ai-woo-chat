/**
 * Knowledge Settings Page
 * 
 * Configure knowledge base and content sources
 */

'use client';

import { useState, useEffect } from 'react';

interface IngestionStatus {
  site_id: string;
  embeddings_count: number;
  ingestion_events: {
    total: number;
    by_status: {
      completed: number;
      failed: number;
      processing: number;
      pending: number;
    };
    recent: Array<{
      event_id: string;
      event_type: string;
      entity_type: string;
      entity_id: string;
      status: string;
      error_message: string | null;
      created_at: string;
      processed_at: string | null;
    }>;
  };
}

export default function KnowledgeSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [ingestionStatus, setIngestionStatus] = useState<IngestionStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState({
    include_products: true,
    include_pages: true,
    include_policies: true,
    include_faq: false,
    auto_index_enabled: true,
    chunk_size: 1000,
    top_k_results: 10,
    similarity_threshold: 0.5,
    max_context_tokens: 4000,
    max_chunks_per_source: 3,
    max_sources: 5,
    embedding_model: 'text-embedding-3-small',
    recency_bias: false,
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('site_id');
    setSiteId(id);

    if (id) {
      loadSettings(id);
      loadIngestionStatus(id);
    }
  }, []);

  const loadIngestionStatus = async (siteId: string) => {
    try {
      setLoadingStatus(true);
      const response = await fetch(`/api/ingestion/status?site_id=${siteId}`);
      if (!response.ok) {
        throw new Error('Failed to load ingestion status');
      }
      const data = await response.json();
      setIngestionStatus(data);
    } catch (error) {
      console.error('Error loading ingestion status:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleSync = async () => {
    if (!siteId) {
      alert('Site ID is required');
      return;
    }

    if (!confirm('This will sync all products from WordPress to the knowledge base. This may take a few minutes. Continue?')) {
      return;
    }

    try {
      setSyncing(true);
      const response = await fetch('/api/ingestion/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_id: siteId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to sync products');
      }

      const result = await response.json();
      alert(`Sync completed!\n\nProducts synced: ${result.products_synced}\nEmbeddings created: ${result.embeddings_created}\nTokens used: ${result.tokens_used}`);
      
      // Reload status after sync
      await loadIngestionStatus(siteId);
    } catch (error) {
      console.error('Error syncing products:', error);
      alert(error instanceof Error ? error.message : 'Failed to sync products');
    } finally {
      setSyncing(false);
    }
  };

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
        top_k_results: data.top_k_results ?? 10,
        similarity_threshold: data.similarity_threshold ?? 0.5,
        max_context_tokens: data.max_context_tokens ?? 4000,
        max_chunks_per_source: data.max_chunks_per_source ?? 3,
        max_sources: data.max_sources ?? 5,
        embedding_model: data.embedding_model || 'text-embedding-3-small',
        recency_bias: data.recency_bias ?? false,
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
          similarity_threshold: settings.similarity_threshold,
          max_context_tokens: settings.max_context_tokens,
          max_chunks_per_source: settings.max_chunks_per_source,
          max_sources: settings.max_sources,
          embedding_model: settings.embedding_model,
          recency_bias: settings.recency_bias,
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

      {/* Ingestion Status Section */}
      {siteId && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Content Ingestion Status</h2>
            <div className="flex gap-2">
              <button
                onClick={() => siteId && loadIngestionStatus(siteId)}
                disabled={loadingStatus}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
              >
                {loadingStatus ? 'Loading...' : '🔄 Refresh'}
              </button>
              <button
                onClick={handleSync}
                disabled={syncing || !siteId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {syncing ? '⏳ Syncing...' : '🚀 Sync Products Now'}
              </button>
            </div>
          </div>

          {loadingStatus ? (
            <p className="text-gray-600">Loading status...</p>
          ) : ingestionStatus ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Embeddings</div>
                  <div className="text-2xl font-bold text-blue-600">{ingestionStatus.embeddings_count}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Completed</div>
                  <div className="text-2xl font-bold text-green-600">{ingestionStatus.ingestion_events.by_status.completed}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Failed</div>
                  <div className="text-2xl font-bold text-red-600">{ingestionStatus.ingestion_events.by_status.failed}</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="text-sm text-gray-600">Pending</div>
                  <div className="text-2xl font-bold text-yellow-600">{ingestionStatus.ingestion_events.by_status.pending}</div>
                </div>
              </div>

              {ingestionStatus.embeddings_count === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">No embeddings found</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>Your knowledge base is empty. Click "Sync Products Now" to import products from WordPress.</p>
                        <p className="mt-1">If webhooks are configured, products will be automatically synced when they are created or updated.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {ingestionStatus.ingestion_events.recent.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Recent Ingestion Events</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Error</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {ingestionStatus.ingestion_events.recent.slice(0, 10).map((event) => (
                          <tr key={event.event_id}>
                            <td className="px-4 py-2 text-sm text-gray-900">{event.entity_type}</td>
                            <td className="px-4 py-2 text-sm">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                event.status === 'completed' ? 'bg-green-100 text-green-800' :
                                event.status === 'failed' ? 'bg-red-100 text-red-800' :
                                event.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {event.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">
                              {new Date(event.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-2 text-sm text-red-600">
                              {event.error_message ? (
                                <span title={event.error_message} className="truncate max-w-xs block">
                                  {event.error_message.substring(0, 50)}...
                                </span>
                              ) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600">No ingestion status available</p>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-8">
        {/* Content Sources Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Content Sources</h2>
          <p className="text-sm text-gray-600 mb-4">
            Select which content types to include in the knowledge base for AI retrieval
          </p>
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
              <div>
                <span className="font-medium text-gray-900">Include Products</span>
                <p className="text-sm text-gray-600">Product descriptions, attributes, and details</p>
              </div>
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
              <div>
                <span className="font-medium text-gray-900">Include Pages</span>
                <p className="text-sm text-gray-600">Static pages and blog posts</p>
              </div>
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
              <div>
                <span className="font-medium text-gray-900">Include Policies</span>
                <p className="text-sm text-gray-600">Shipping, returns, terms, privacy policies</p>
              </div>
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
              <div>
                <span className="font-medium text-gray-900">Include FAQ</span>
                <p className="text-sm text-gray-600">Frequently asked questions and answers</p>
              </div>
            </label>
          </div>
        </div>

        {/* Indexing Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Indexing</h2>
          <div className="space-y-4">
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
                <div>
                  <span className="font-medium text-gray-900">Auto-Index Content Changes</span>
                  <p className="text-sm text-gray-600 mt-1">
                    Automatically update knowledge base when content is created or updated via webhooks
                  </p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Chunk Size (characters)
              </label>
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
                Size of text chunks for embedding. Larger chunks = more context, but may be less precise. Recommended: 800-1200 characters.
              </p>
            </div>
          </div>
        </div>

        {/* Retrieval Settings Section */}
        <div className="border-b pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Retrieval Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Top-K Results
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={settings.top_k_results}
                onChange={(e) =>
                  setSettings({ ...settings, top_k_results: parseInt(e.target.value) || 10 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                Number of relevant chunks to retrieve per query. Higher = more context but slower. Recommended: 5-10.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Similarity Threshold
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={settings.similarity_threshold}
                onChange={(e) =>
                  setSettings({ ...settings, similarity_threshold: parseFloat(e.target.value) || 0.5 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                Minimum similarity score (0-1) for chunks to be included. Higher = more precise but may miss relevant results. Recommended: 0.4-0.6.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Max Context Tokens
              </label>
              <input
                type="number"
                min="1000"
                max="8000"
                step="500"
                value={settings.max_context_tokens}
                onChange={(e) =>
                  setSettings({ ...settings, max_context_tokens: parseInt(e.target.value) || 4000 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                Maximum tokens to include in context sent to AI. Higher = more context but higher costs. Recommended: 3000-5000.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Max Chunks per Source
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.max_chunks_per_source}
                onChange={(e) =>
                  setSettings({ ...settings, max_chunks_per_source: parseInt(e.target.value) || 3 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                Maximum chunks to include from a single source (product/page). Prevents one source from dominating context. Recommended: 2-4.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Max Sources
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.max_sources}
                onChange={(e) =>
                  setSettings({ ...settings, max_sources: parseInt(e.target.value) || 5 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <p className="text-sm text-gray-600 mt-1">
                Maximum number of unique sources (products/pages) to include in context. Recommended: 3-7.
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Settings Section */}
        <div className="pb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Embedding Model
              </label>
              <select
                value={settings.embedding_model}
                onChange={(e) =>
                  setSettings({ ...settings, embedding_model: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="text-embedding-3-small">text-embedding-3-small (Fast, Cost-effective)</option>
                <option value="text-embedding-3-large">text-embedding-3-large (More accurate, Higher cost)</option>
                <option value="text-embedding-ada-002">text-embedding-ada-002 (Legacy, Lower cost)</option>
              </select>
              <p className="text-sm text-gray-600 mt-1">
                OpenAI embedding model to use. Larger models = better accuracy but higher cost.
              </p>
            </div>

            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.recency_bias}
                  onChange={(e) =>
                    setSettings({ ...settings, recency_bias: e.target.checked })
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-medium text-gray-900">Recency Bias</span>
                  <p className="text-sm text-gray-600 mt-1">
                    Prioritize recently updated content when multiple chunks have similar similarity scores
                  </p>
                </div>
              </label>
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
