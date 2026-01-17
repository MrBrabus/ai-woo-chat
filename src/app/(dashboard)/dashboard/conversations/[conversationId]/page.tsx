/**
 * Conversation Detail Page
 * 
 * Shows conversation messages and details
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils/date-format';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content_text: string;
  content_json?: any;
  token_usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  } | null;
  created_at: string;
  metadata?: any;
}

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
  messages: Message[];
}

export default function ConversationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.conversationId as string;
  const siteId = searchParams.get('site_id');
  const fromAdmin = searchParams.get('from') === 'admin';
  const tenantId = searchParams.get('tenant_id');

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId && siteId) {
      loadConversation(conversationId, siteId);
    }
  }, [conversationId, siteId]);

  const loadConversation = async (convId: string, siteId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/conversations/${convId}?site_id=${siteId}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to load conversation');
      }

      const data = await response.json();
      setConversation(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <p className="text-gray-600">Loading conversation...</p>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error || 'Conversation not found'}
        </div>
        <Link 
          href={
            fromAdmin && tenantId
              ? `/admin/conversations?tenant_id=${tenantId}`
              : siteId
              ? `/dashboard/conversations?site_id=${siteId}`
              : '/dashboard/conversations'
          } 
          className="mt-4 inline-block text-indigo-600 hover:text-indigo-900 font-medium"
        >
          ← Back to Conversations
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href={
            fromAdmin && tenantId
              ? `/admin/conversations?tenant_id=${tenantId}`
              : siteId
              ? `/dashboard/conversations?site_id=${siteId}`
              : '/dashboard/conversations'
          }
          className="text-indigo-600 hover:text-indigo-900 mb-4 inline-block font-medium"
        >
          ← Back to Conversations
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">Conversation Details</h1>
        <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-2 text-sm text-gray-600">
          <p>
            <span className="font-medium text-gray-900">Visitor ID:</span>{' '}
            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{conversation.visitor_id}</code>
          </p>
          <p>
            <span className="font-medium text-gray-900">Created:</span>{' '}
            {formatDateTime(conversation.created_at)}
          </p>
          <p>
            <span className="font-medium text-gray-900">Messages:</span>{' '}
            <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
              {conversation.messages.length} {conversation.message_count !== conversation.messages.length && `(DB: ${conversation.message_count})`}
            </span>
          </p>
          {conversation.last_message_at && (
            <p>
              <span className="font-medium text-gray-900">Last Message:</span>{' '}
              {formatDateTime(conversation.last_message_at)}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Messages</h2>
        <div className="space-y-4">
          {conversation.messages.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No messages in this conversation.</p>
          ) : (
            conversation.messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 rounded-lg border ${
                  message.role === 'user'
                    ? 'bg-blue-50 border-blue-200 ml-8'
                    : 'bg-gray-50 border-gray-200 mr-8'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`font-medium text-sm px-2 py-1 rounded ${
                    message.role === 'user'
                      ? 'bg-blue-200 text-blue-800'
                      : 'bg-gray-200 text-gray-800'
                  }`}>
                    {message.role === 'user' ? 'User' : 'Assistant'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateTime(message.created_at)}
                  </span>
                </div>
                <p className="text-gray-900 whitespace-pre-wrap">{message.content_text}</p>
                {message.token_usage && (
                  <div className="text-xs text-gray-500 mt-2 space-y-1">
                    <p className="font-medium">Token Usage:</p>
                    <div className="ml-2 space-y-0.5">
                      {message.token_usage.prompt_tokens !== undefined && (
                        <p>Prompt: {message.token_usage.prompt_tokens.toLocaleString()}</p>
                      )}
                      {message.token_usage.completion_tokens !== undefined && (
                        <p>Completion: {message.token_usage.completion_tokens.toLocaleString()}</p>
                      )}
                      {message.token_usage.total_tokens !== undefined && (
                        <p className="font-medium">Total: {message.token_usage.total_tokens.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                )}
                {message.content_json?.products && Array.isArray(message.content_json.products) && (
                  <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                    <p className="font-medium text-xs text-gray-700 mb-2">Product Recommendations:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {message.content_json.products.map((product: any, idx: number) => (
                        <li key={idx} className="text-xs text-gray-600">
                          {product.title || product.id} {product.price && `($${product.price})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {message.content_json?.evidence && Array.isArray(message.content_json.evidence) && (
                  <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                    <p className="font-medium text-xs text-gray-700 mb-2">Sources:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {message.content_json.evidence.map((ev: any, idx: number) => (
                        <li key={idx} className="text-xs text-gray-600">
                          {ev.type}: {ev.ref_id} {ev.score && `(${ev.score.toFixed(2)})`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
