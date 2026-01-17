/**
 * Analytics Page
 * 
 * Shows analytics and statistics for conversations, messages, and usage
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatDateTime, formatDate } from '@/lib/utils/date-format';

interface AnalyticsData {
  period: {
    days: number;
    start_date: string;
    end_date: string;
  };
  overview: {
    total_conversations: number;
    total_messages: number;
    user_messages: number;
    assistant_messages: number;
    total_tokens: number;
    prompt_tokens: number;
    completion_tokens: number;
    product_views: number;
    product_clicks: number;
    add_to_cart: number;
  };
  daily: {
    conversations: Record<string, number>;
    messages: Record<string, number>;
    usage: Array<{
      date: string;
      tokens: number;
      requests: number;
    }>;
  };
}

export default function AnalyticsPage() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get('site_id');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (siteId) {
      loadAnalytics(siteId, days);
    } else {
      setError('Site ID is required');
      setLoading(false);
    }
  }, [siteId, days]);

  const loadAnalytics = async (siteId: string, days: number) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/analytics?site_id=${siteId}&days=${days}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to load analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Loading analytics...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Failed to load analytics'}
        </div>
        {!siteId && (
          <p className="mt-4 text-gray-600">
            Please select a site from the Sites page first.
          </p>
        )}
      </div>
    );
  }

  // Calculate averages
  const avgMessagesPerConversation = analytics.overview.total_conversations > 0
    ? (analytics.overview.total_messages / analytics.overview.total_conversations).toFixed(1)
    : '0';

  const avgTokensPerMessage = analytics.overview.assistant_messages > 0
    ? (analytics.overview.total_tokens / analytics.overview.assistant_messages).toFixed(0)
    : '0';

  const clickThroughRate = analytics.overview.product_views > 0
    ? ((analytics.overview.product_clicks / analytics.overview.product_views) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">
            Period: {formatDate(analytics.period.start_date)} - {formatDate(analytics.period.end_date)}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-sm text-gray-600">Period:</label>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last year</option>
          </select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Conversations</h3>
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.overview.total_conversations.toLocaleString()}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Messages</h3>
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.overview.total_messages.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">
            Avg: {avgMessagesPerConversation} per conversation
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Tokens</h3>
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.overview.total_tokens.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">
            Avg: {avgTokensPerMessage} per message
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Product Interactions</h3>
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.overview.product_views.toLocaleString()}</p>
          <p className="text-sm text-gray-500 mt-1">
            {analytics.overview.product_clicks} clicks ({clickThroughRate}% CTR)
          </p>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Token Usage</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Prompt Tokens</span>
                <span className="text-sm font-medium text-gray-900">
                  {analytics.overview.prompt_tokens.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full"
                  style={{
                    width: `${analytics.overview.total_tokens > 0 ? (analytics.overview.prompt_tokens / analytics.overview.total_tokens) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Completion Tokens</span>
                <span className="text-sm font-medium text-gray-900">
                  {analytics.overview.completion_tokens.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full"
                  style={{
                    width: `${analytics.overview.total_tokens > 0 ? (analytics.overview.completion_tokens / analytics.overview.total_tokens) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div className="pt-4 border-t">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-900">Total</span>
                <span className="text-sm font-bold text-gray-900">
                  {analytics.overview.total_tokens.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Breakdown */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Message Breakdown</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">User Messages</span>
                <span className="text-sm font-medium text-gray-900">
                  {analytics.overview.user_messages.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full"
                  style={{
                    width: `${analytics.overview.total_messages > 0 ? (analytics.overview.user_messages / analytics.overview.total_messages) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-gray-600">Assistant Messages</span>
                <span className="text-sm font-medium text-gray-900">
                  {analytics.overview.assistant_messages.toLocaleString()}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gray-600 h-2 rounded-full"
                  style={{
                    width: `${analytics.overview.total_messages > 0 ? (analytics.overview.assistant_messages / analytics.overview.total_messages) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product Engagement */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Engagement</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-900">{analytics.overview.product_views.toLocaleString()}</p>
            <p className="text-sm text-gray-600 mt-1">Product Views</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-900">{analytics.overview.product_clicks.toLocaleString()}</p>
            <p className="text-sm text-gray-600 mt-1">Product Clicks</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-900">{analytics.overview.add_to_cart.toLocaleString()}</p>
            <p className="text-sm text-gray-600 mt-1">Add to Cart</p>
          </div>
        </div>
      </div>

      {/* Daily Trends */}
      {Object.keys(analytics.daily.conversations).length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Trends</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conversations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Messages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tokens
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.keys(analytics.daily.conversations)
                  .sort()
                  .reverse()
                  .slice(0, 14)
                  .map((date) => (
                    <tr key={date}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analytics.daily.conversations[date] || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analytics.daily.messages[date] || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analytics.daily.usage.find(u => u.date === date)?.tokens.toLocaleString() || '0'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
