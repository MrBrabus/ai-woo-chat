/**
 * Email Settings Page
 * 
 * Dashboard page for configuring email settings
 */

'use client';

import { useState, useEffect } from 'react';

export default function EmailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    enabled: false,
    from_email: '',
    reply_to: '',
    send_conversation_summaries: false,
    summary_recipients: [] as string[],
  });
  const [newRecipient, setNewRecipient] = useState('');

  useEffect(() => {
    // Get site_id from URL
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
      const response = await fetch(`/api/email/settings?site_id=${siteId}`);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await response.json();
      setSettings({
        enabled: data.enabled || false,
        from_email: data.fromEmail || '',
        reply_to: data.replyTo || '',
        send_conversation_summaries: data.sendConversationSummaries || false,
        summary_recipients: data.summaryRecipients || [],
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
      const response = await fetch('/api/email/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_id: siteId,
          enabled: settings.enabled,
          from_email: settings.from_email || undefined,
          reply_to: settings.reply_to || undefined,
          send_conversation_summaries: settings.send_conversation_summaries,
          summary_recipients: settings.summary_recipients,
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

  const handleAddRecipient = () => {
    if (newRecipient.trim() && !settings.summary_recipients.includes(newRecipient.trim())) {
      setSettings({
        ...settings,
        summary_recipients: [...settings.summary_recipients, newRecipient.trim()],
      });
      setNewRecipient('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    setSettings({
      ...settings,
      summary_recipients: settings.summary_recipients.filter((e) => e !== email),
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Email Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Enable Email Service */}
        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium text-gray-900">Enable Email Service</span>
          </label>
          <p className="text-sm text-gray-600 mt-1 ml-6">
            Enable sending emails via Resend API
          </p>
        </div>

        {/* From Email */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            From Email Address
          </label>
          <input
            type="email"
            value={settings.from_email}
            onChange={(e) => setSettings({ ...settings, from_email: e.target.value })}
            placeholder="noreply@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
            disabled={!settings.enabled}
          />
          <p className="text-sm text-gray-600 mt-1">
            Default sender email address (must be verified in Resend)
          </p>
        </div>

        {/* Reply To */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Reply-To Email Address
          </label>
          <input
            type="email"
            value={settings.reply_to}
            onChange={(e) => setSettings({ ...settings, reply_to: e.target.value })}
            placeholder="support@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
            disabled={!settings.enabled}
          />
          <p className="text-sm text-gray-600 mt-1">
            Email address for replies (optional)
          </p>
        </div>

        {/* Conversation Summaries */}
        <div className="border-t pt-6">
          <label className="flex items-center space-x-2 mb-4">
            <input
              type="checkbox"
              checked={settings.send_conversation_summaries}
              onChange={(e) =>
                setSettings({ ...settings, send_conversation_summaries: e.target.checked })
              }
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              disabled={!settings.enabled}
            />
            <span className="font-medium text-gray-900">Send Conversation Summaries</span>
          </label>
          <p className="text-sm text-gray-600 mb-4 ml-6">
            Automatically send email summaries of chat conversations
          </p>

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Summary Recipients
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="email"
                value={newRecipient}
                onChange={(e) => setNewRecipient(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddRecipient();
                  }
                }}
                placeholder="email@example.com"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                disabled={!settings.enabled || !settings.send_conversation_summaries}
              />
              <button
                onClick={handleAddRecipient}
                disabled={!settings.enabled || !settings.send_conversation_summaries}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
            <div className="space-y-2">
              {settings.summary_recipients.map((email) => (
                <div
                  key={email}
                  className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                >
                  <span className="text-sm text-gray-900">{email}</span>
                  <button
                    onClick={() => handleRemoveRecipient(email)}
                    className="text-red-600 hover:text-red-800 text-sm disabled:text-gray-400"
                    disabled={!settings.enabled || !settings.send_conversation_summaries}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Save Button */}
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
