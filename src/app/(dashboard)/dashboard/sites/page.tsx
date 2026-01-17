/**
 * Dashboard Sites Management Page
 * Allows users to view, detach, and promote sites
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from '@/lib/utils/date-format';

interface License {
  id: string;
  license_key: string;
  status: 'active' | 'expired' | 'revoked' | 'suspended';
  expires_at: string | null;
  max_sites: number;
  plan_limits: {
    max_tokens_per_day?: number;
    max_chat_requests_per_day?: number;
    max_embedding_tokens_per_day?: number;
    detach_cooldown_hours?: number;
    max_detach_per_month?: number;
  };
}

interface Site {
  id: string;
  site_url: string;
  site_name: string;
  environment: string;
  status: string;
  last_paired_at: string;
  disabled_at?: string | null;
  tenant_id: string;
  license_id: string;
  created_at: string;
  allowed_origins?: string[];
  license?: License;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detaching, setDetaching] = useState<string | null>(null);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoteUrl, setPromoteUrl] = useState('');
  const [promoteSiteId, setPromoteSiteId] = useState<string | null>(null);

  useEffect(() => {
    loadSites();
  }, []);

  async function loadSites() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Get user's tenant
      const { data: userTenants, error: tenantError } = await supabase
        .from('user_tenants')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (tenantError || !userTenants) {
        throw new Error('No tenant found for user');
      }

      // Get all sites for this tenant with license information
      const { data: sitesData, error: sitesError } = await supabase
        .from('sites')
        .select(`
          *,
          license:licenses (
            id,
            license_key,
            status,
            expires_at,
            max_sites,
            plan_limits
          )
        `)
        .eq('tenant_id', userTenants.tenant_id)
        .order('last_paired_at', { ascending: false, nullsFirst: false });

      if (sitesError) {
        throw new Error(sitesError.message || 'Failed to load sites');
      }

      setSites(sitesData || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sites');
      console.error('Error loading sites:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDetach(site_id: string) {
    if (!confirm('Are you sure you want to detach this site? This will disable chat for this domain.')) {
      return;
    }

    try {
      setDetaching(site_id);
      setError(null);

      const response = await fetch('/api/sites/detach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ site_id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to detach site');
      }

      await loadSites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to detach site');
    } finally {
      setDetaching(null);
    }
  }

  async function handlePromote(site_id: string, new_url: string) {
    if (!new_url || !new_url.startsWith('http')) {
      setError('Please enter a valid URL (must start with http:// or https://)');
      return;
    }

    try {
      setPromoting(site_id);
      setError(null);

      const response = await fetch('/api/sites/promote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_id,
          new_site_url: new_url,
          new_environment: 'production',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to promote site');
      }

      const data = await response.json();
      setPromoteSiteId(null);
      setPromoteUrl('');
      await loadSites();

      // Show success message with new site_secret if returned
      if (data.site_secret) {
        alert(`Site promoted successfully! New site secret: ${data.site_secret}\n\nUpdate your WordPress plugin with this new secret.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to promote site');
    } finally {
      setPromoting(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Sites</h1>
        <p className="text-gray-600">Loading sites...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
        <button
          onClick={loadSites}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {sites.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 text-lg">No sites found.</p>
          <p className="text-gray-500 text-sm mt-2">Activate a license to add your first site.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="border border-gray-200 rounded-lg p-6 bg-white shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="font-semibold text-lg text-gray-900">{site.site_url}</h3>
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        site.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {site.status}
                    </span>
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        site.environment === 'production'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {site.environment}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {site.site_name && (
                      <p>
                        <span className="font-medium">Name:</span> {site.site_name}
                      </p>
                    )}
                    {site.last_paired_at && (
                      <p>
                        <span className="font-medium">Last Paired:</span>{' '}
                        {formatDateTime(site.last_paired_at)}
                      </p>
                    )}
                    {site.disabled_at && (
                      <p className="text-red-600">
                        <span className="font-medium">Disabled:</span>{' '}
                        {formatDateTime(site.disabled_at)}
                      </p>
                    )}
                    <p>
                      <span className="font-medium">Site ID:</span>{' '}
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">{site.id}</code>
                    </p>
                    <p>
                      <span className="font-medium">Created:</span>{' '}
                      {formatDateTime(site.created_at)}
                    </p>
                    {site.allowed_origins && site.allowed_origins.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Allowed Origins (CORS):</p>
                        <div className="space-y-0.5">
                          {site.allowed_origins.map((origin, idx) => (
                            <code key={idx} className="block text-xs bg-gray-100 px-2 py-1 rounded text-gray-800">
                              {origin}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* License Information */}
                    {site.license && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-900 mb-2">License Information</p>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>
                            <span className="font-medium">License Key:</span>{' '}
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                              {site.license.license_key.substring(0, 20)}...
                            </code>
                          </p>
                          <p>
                            <span className="font-medium">Status:</span>{' '}
                            <span
                              className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                site.license.status === 'active'
                                  ? 'bg-green-100 text-green-800'
                                  : site.license.status === 'expired'
                                  ? 'bg-red-100 text-red-800'
                                  : site.license.status === 'revoked'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {site.license.status}
                            </span>
                          </p>
                          {site.license.expires_at ? (
                            <p>
                              <span className="font-medium">Expires:</span>{' '}
                              <span
                                className={
                                  new Date(site.license.expires_at) < new Date()
                                    ? 'text-red-600 font-semibold'
                                    : new Date(site.license.expires_at) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                                    ? 'text-yellow-600 font-semibold'
                                    : 'text-gray-900'
                                }
                              >
                                {formatDateTime(site.license.expires_at)}
                                {new Date(site.license.expires_at) < new Date() && ' (Expired)'}
                                {new Date(site.license.expires_at) >= new Date() &&
                                  new Date(site.license.expires_at) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                                  ' (Expires soon)'}
                              </span>
                            </p>
                          ) : (
                            <p>
                              <span className="font-medium">Expires:</span>{' '}
                              <span className="text-gray-500">Never (Lifetime license)</span>
                            </p>
                          )}
                          {site.license.plan_limits && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <p className="text-xs font-semibold text-gray-700 mb-1">Plan Limits:</p>
                              <div className="text-xs text-gray-600 space-y-0.5">
                                {site.license.plan_limits.max_tokens_per_day && (
                                  <p>• Tokens/day: {site.license.plan_limits.max_tokens_per_day.toLocaleString()}</p>
                                )}
                                {site.license.plan_limits.max_chat_requests_per_day && (
                                  <p>• Requests/day: {site.license.plan_limits.max_chat_requests_per_day.toLocaleString()}</p>
                                )}
                                {site.license.plan_limits.max_sites && (
                                  <p>• Max Sites: {site.license.max_sites}</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {/* Quick Actions */}
                  <div className="flex gap-2 flex-wrap">
                    <Link
                      href={`/dashboard/conversations?site_id=${site.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors"
                      title="View Conversations"
                    >
                      💬 Conversations
                    </Link>
                    <Link
                      href={`/dashboard/analytics?site_id=${site.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
                      title="View Analytics"
                    >
                      📊 Analytics
                    </Link>
                    <Link
                      href={`/dashboard/settings/voice?site_id=${site.id}`}
                      className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
                      title="Settings"
                    >
                      ⚙️ Settings
                    </Link>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(site.id);
                        alert('Site ID copied to clipboard!');
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                      title="Copy Site ID"
                    >
                      📋 Copy ID
                    </button>
                  </div>
                  
                  {/* Site Actions */}
                  {site.status === 'active' && (
                    <>
                      <button
                        onClick={() => setPromoteSiteId(site.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium transition-colors"
                        disabled={promoting === site.id}
                      >
                        Promote
                      </button>
                      <button
                        onClick={() => handleDetach(site.id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
                        disabled={detaching === site.id}
                      >
                        {detaching === site.id ? 'Detaching...' : 'Detach'}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {promoteSiteId === site.id && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-semibold text-gray-900 mb-2">Promote to Production</h4>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={promoteUrl}
                      onChange={(e) => setPromoteUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={() => handlePromote(site.id, promoteUrl)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      disabled={promoting === site.id}
                    >
                      {promoting === site.id ? 'Promoting...' : 'Promote'}
                    </button>
                    <button
                      onClick={() => {
                        setPromoteSiteId(null);
                        setPromoteUrl('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
