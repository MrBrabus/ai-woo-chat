/**
 * Admin: Conversations Page
 * Super admin only - allows browsing tenants and their conversations
 * 
 * Query params:
 * - tenant_id: Filter conversations by tenant
 * - search: Search conversation IDs
 */

'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  conversation_count?: number;
}

interface Conversation {
  id: string;
  conversation_id: string;
  site_id: string;
  visitor_id: string | null;
  started_at: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
  site: {
    id: string;
    site_url: string;
    site_name: string;
    license_id: string;
    license: {
      id: string;
      license_key: string;
      customer_email: string | null;
    };
  } | null;
}

// Helper function for date formatting
function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });
}

export default function AdminConversationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  
  const selectedTenantId = searchParams.get('tenant_id');
  const conversationSearch = searchParams.get('search') || '';
  
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [tenantSearch, setTenantSearch] = useState('');
  const [conversationSearchInput, setConversationSearchInput] = useState(conversationSearch);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Load tenants on mount
  useEffect(() => {
    loadTenants();
  }, []);

  // Load conversations when tenant is selected or search changes
  useEffect(() => {
    if (selectedTenantId) {
      loadTenantDetails(selectedTenantId);
      loadConversations(selectedTenantId, conversationSearch);
    } else {
      setConversations([]);
      setSelectedTenant(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTenantId, conversationSearch]);

  const loadTenants = async () => {
    try {
      setLoadingTenants(true);
      const response = await fetch('/api/admin/conversations/tenants');
      if (!response.ok) throw new Error('Failed to load tenants');
      const data = await response.json();
      setTenants(data.tenants || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadTenantDetails = async (tenantId: string) => {
    try {
      const response = await fetch(`/api/admin/conversations/tenants/${tenantId}`);
      if (!response.ok) throw new Error('Failed to load tenant details');
      const data = await response.json();
      setSelectedTenant(data.tenant || null);
    } catch (error) {
      console.error('Error loading tenant details:', error);
    }
  };

  const loadConversations = async (tenantId: string, search: string = '') => {
    try {
      setLoadingConversations(true);
      const url = `/api/admin/conversations?tenant_id=${tenantId}${search ? `&search=${encodeURIComponent(search)}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load conversations');
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleTenantSelect = (tenantId: string) => {
    startTransition(() => {
      const params = new URLSearchParams();
      params.set('tenant_id', tenantId);
      if (conversationSearch) {
        params.set('search', conversationSearch);
      }
      router.push(`/admin/conversations?${params.toString()}`);
    });
  };

  const handleTenantSearch = (query: string) => {
    setTenantSearch(query);
  };

  const handleConversationSearch = () => {
    startTransition(() => {
      const params = new URLSearchParams();
      if (selectedTenantId) {
        params.set('tenant_id', selectedTenantId);
      }
      if (conversationSearchInput.trim()) {
        params.set('search', conversationSearchInput.trim());
      }
      router.push(`/admin/conversations?${params.toString()}`);
    });
  };

  const handleBackToTenants = () => {
    startTransition(() => {
      router.push('/admin/conversations');
    });
  };

  // Filter tenants by search
  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(tenantSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {selectedTenant ? `Conversations: ${selectedTenant.name}` : 'All Conversations'}
          </h1>
          <p className="text-gray-600 mt-1">
            {selectedTenant 
              ? `Browse conversations for this tenant. ${conversations.length} conversation${conversations.length !== 1 ? 's' : ''} found.`
              : 'Select a tenant to view their conversations'
            }
          </p>
        </div>
        {selectedTenant && (
          <button
            onClick={handleBackToTenants}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            ← Back to Tenants
          </button>
        )}
      </div>

      {!selectedTenantId ? (
        /* Tenants List */
        <div className="space-y-4">
          {/* Search Tenants */}
          <div className="card-modern p-4">
            <label htmlFor="tenant-search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Tenants
            </label>
            <input
              id="tenant-search"
              type="text"
              value={tenantSearch}
              onChange={(e) => handleTenantSearch(e.target.value)}
              placeholder="Search by tenant name or slug..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
            />
          </div>

          {/* Tenants Table */}
          {loadingTenants ? (
            <div className="card-modern p-12 text-center">
              <p className="text-gray-500">Loading tenants...</p>
            </div>
          ) : (
            <div className="card-modern overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tenant Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Slug
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Conversations
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTenants.map((tenant) => (
                      <tr key={tenant.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <code className="text-sm font-mono text-gray-500">{tenant.slug}</code>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              tenant.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : tenant.status === 'suspended'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {tenant.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {tenant.conversation_count ?? '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleTenantSelect(tenant.id)}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            View Conversations
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredTenants.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No tenants found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Conversations List */
        <div className="space-y-4">
          {/* Search Conversations */}
          <div className="card-modern p-4">
            <label htmlFor="conversation-search" className="block text-sm font-medium text-gray-700 mb-2">
              Search Conversations by ID
            </label>
            <div className="flex gap-2">
              <input
                id="conversation-search"
                type="text"
                value={conversationSearchInput}
                onChange={(e) => setConversationSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConversationSearch();
                  }
                }}
                placeholder="Enter conversation ID (e.g., conv_xyz789)..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900 bg-white"
              />
              <button
                onClick={handleConversationSearch}
                disabled={isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {isPending ? 'Searching...' : 'Search'}
              </button>
              {conversationSearch && (
                <button
                  onClick={() => {
                    setConversationSearchInput('');
                    startTransition(() => {
                      const params = new URLSearchParams();
                      params.set('tenant_id', selectedTenantId);
                      router.push(`/admin/conversations?${params.toString()}`);
                    });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Conversations Table */}
          {loadingConversations ? (
            <div className="card-modern p-12 text-center">
              <p className="text-gray-500">Loading conversations...</p>
            </div>
          ) : (
            <div className="card-modern overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Conversation ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Site
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Messages
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Started
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Last Message
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {conversations.map((conversation) => (
                      <tr key={conversation.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <code className="text-sm font-mono text-gray-900 break-all">
                            {conversation.conversation_id}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {conversation.site?.site_name || 'N/A'}
                            </div>
                            <div className="text-gray-500 text-xs mt-1">
                              {conversation.site?.site_url || ''}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {conversation.message_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(conversation.started_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDateTime(conversation.last_message_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <Link
                            href={`/dashboard/conversations/${conversation.id}?site_id=${conversation.site_id}&from=admin&tenant_id=${selectedTenantId || ''}`}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {conversations.length === 0 && !loadingConversations && (
                <div className="text-center py-12">
                  <p className="text-gray-500">
                    {conversationSearch 
                      ? `No conversations found matching "${conversationSearch}".`
                      : 'No conversations found for this tenant.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
