/**
 * Conversations View Page
 * 
 * Lists all conversations for a site
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils/date-format';

interface Conversation {
  id: string;
  conversation_id: string;
  site_id: string;
  visitor_id: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
  visitor: {
    visitor_id: string;
    first_seen_at: string;
    last_seen_at: string;
  } | null;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);

  useEffect(() => {
    // Get site_id from URL or context
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('site_id');
    setSiteId(id);

    if (id) {
      loadConversations(id);
    }
  }, []);

  const loadConversations = async (siteId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/conversations?site_id=${siteId}&limit=100`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to load conversations');
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Conversations</h1>
        <p className="text-gray-600">Loading conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Conversations</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
        {!siteId && (
          <p className="mt-4 text-gray-600">
            Please select a site to view conversations.
          </p>
        )}
      </div>
    );
  }

  if (!siteId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Conversations</h1>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 text-lg">No site selected.</p>
          <p className="text-gray-500 text-sm mt-2">
            Please select a site from the Sites page to view conversations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conversations</h1>
        <button
          onClick={() => loadConversations(siteId)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 text-lg">No conversations found.</p>
          <p className="text-gray-500 text-sm mt-2">
            Conversations will appear here once visitors start chatting.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visitor ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Messages
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Message
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {conversations.map((conv) => (
                <tr key={conv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {conv.visitor_id.substring(0, 12)}...
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                      {conv.message_count}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {conv.last_message_at
                      ? formatDateTime(conv.last_message_at)
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(conv.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      href={`/dashboard/conversations/${conv.conversation_id}?site_id=${conv.site_id}`}
                      className="text-indigo-600 hover:text-indigo-900 font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
