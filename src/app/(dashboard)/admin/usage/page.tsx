/**
 * Admin: Usage Analytics Page
 * Super admin only - displays usage analytics across all licenses
 */

import { createAdminClient } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/auth/check-super-admin';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AdminUsagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is super admin
  const admin = await isSuperAdmin(user.id);
  if (!admin) {
    redirect('/dashboard');
  }

  const supabaseAdmin = createAdminClient();

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();
  const last30Days = new Date(today);
  last30Days.setDate(last30Days.getDate() - 30);
  const last30DaysISO = last30Days.toISOString();

  // Get summary statistics
  const [totalLicenses, totalSites, totalUsage, licensesUsage] = await Promise.all([
    // Total active licenses
    supabaseAdmin
      .from('licenses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    
    // Total active sites
    supabaseAdmin
      .from('sites')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    
    // Total usage (last 30 days)
    supabaseAdmin
      .from('usage_events')
      .select('total_tokens', { count: 'exact' })
      .gte('created_at', last30DaysISO),
    
    // Usage per license (last 30 days) - get all events
    supabaseAdmin
      .from('usage_events')
      .select(`
        site_id,
        total_tokens,
        type,
        sites (
          id,
          license_id,
          licenses (
            id,
            license_key,
            customer_email,
            tenant_id,
            tenants (
              id,
              name
            )
          )
        )
      `)
      .gte('created_at', last30DaysISO)
  ]);

  // Aggregate usage by license
  interface LicenseUsage {
    license_id: string;
    license_key: string;
    customer_email: string | null;
    tenant_name: string;
    total_tokens: number;
    chat_requests: number;
    embedding_requests: number;
  }

  const licenseUsageMap = new Map<string, LicenseUsage>();
  
  if (licensesUsage.data) {
    licensesUsage.data.forEach((event: any) => {
      // Handle nested structure: event.sites -> licenses -> tenants
      const site = Array.isArray(event.sites) ? event.sites[0] : event.sites;
      const license = Array.isArray(site?.licenses) ? site.licenses[0] : site?.licenses;
      
      if (!license || !license.id) return;
      
      const licenseId = license.id;
      const tenant = Array.isArray(license.tenants) ? license.tenants[0] : license.tenants;
      
      const existing = licenseUsageMap.get(licenseId);
      
      if (existing) {
        existing.total_tokens += event.total_tokens || 0;
        if (event.type === 'chat') {
          existing.chat_requests += 1;
        } else if (event.type === 'embedding') {
          existing.embedding_requests += 1;
        }
      } else {
        licenseUsageMap.set(licenseId, {
          license_id: licenseId,
          license_key: license.license_key || 'N/A',
          customer_email: license.customer_email || null,
          tenant_name: tenant?.name || 'N/A',
          total_tokens: event.total_tokens || 0,
          chat_requests: event.type === 'chat' ? 1 : 0,
          embedding_requests: event.type === 'embedding' ? 1 : 0,
        });
      }
    });
  }

  const licensesUsageArray = Array.from(licenseUsageMap.values())
    .sort((a, b) => b.total_tokens - a.total_tokens);

  // Calculate total tokens
  const totalTokens = licensesUsageArray.reduce((sum, l) => sum + l.total_tokens, 0);
  const totalChatRequests = licensesUsageArray.reduce((sum, l) => sum + l.chat_requests, 0);
  const totalEmbeddingRequests = licensesUsageArray.reduce((sum, l) => sum + l.embedding_requests, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usage Analytics</h1>
          <p className="text-gray-600 mt-1">Monitor token usage and API requests across all licenses</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card-modern p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Active Licenses</h3>
          <p className="text-3xl font-bold text-gray-900">{totalLicenses.count || 0}</p>
        </div>
        <div className="card-modern p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Active Sites</h3>
          <p className="text-3xl font-bold text-gray-900">{totalSites.count || 0}</p>
        </div>
        <div className="card-modern p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Total Tokens (30d)</h3>
          <p className="text-3xl font-bold text-gray-900">
            {totalTokens.toLocaleString()}
          </p>
        </div>
        <div className="card-modern p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">Chat Requests (30d)</h3>
          <p className="text-3xl font-bold text-gray-900">{totalChatRequests.toLocaleString()}</p>
        </div>
      </div>

      {/* Usage by License Table */}
      <div className="card-modern overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Usage by License (Last 30 Days)</h2>
          <p className="text-sm text-gray-600 mt-1">Token usage and API requests per license, sorted by usage</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  License Key
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Tokens
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Chat Requests
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Embedding Requests
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {licensesUsageArray.length > 0 ? (
                licensesUsageArray.map((usage) => (
                  <tr key={usage.license_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <code className="text-sm font-mono text-gray-900 break-all">
                        {usage.license_key}
                      </code>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {usage.customer_email ? (
                          <a 
                            href={`mailto:${usage.customer_email}`}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {usage.customer_email}
                          </a>
                        ) : (
                          <span className="text-gray-400 italic">No email</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{usage.tenant_name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {usage.total_tokens.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {usage.chat_requests.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {usage.embedding_requests.toLocaleString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <p>No usage data found for the last 30 days.</p>
                    <p className="text-sm mt-2">Usage data is recorded when chat messages or embeddings are processed.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Additional Stats */}
      {licensesUsageArray.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-modern p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Embedding Requests</h3>
            <p className="text-3xl font-bold text-gray-900">{totalEmbeddingRequests.toLocaleString()}</p>
          </div>
          <div className="card-modern p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Avg Tokens per Request</h3>
            <p className="text-3xl font-bold text-gray-900">
              {totalChatRequests > 0 
                ? Math.round(totalTokens / totalChatRequests).toLocaleString()
                : '0'
              }
            </p>
          </div>
          <div className="card-modern p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Licenses with Usage</h3>
            <p className="text-3xl font-bold text-gray-900">{licensesUsageArray.length}</p>
          </div>
        </div>
      )}
    </div>
  );
}
