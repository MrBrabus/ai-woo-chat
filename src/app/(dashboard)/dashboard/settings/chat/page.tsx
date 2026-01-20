/**
 * Chat Settings Page
 * 
 * Configure chat widget appearance and behavior
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export default function ChatSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    title: 'AI Assistant',
    welcome_message: 'Hello! I am your AI assistant. How can I help you today?',
    input_placeholder: 'Type your message...',
    send_button_text: 'Send',
    avatar_url: null as string | null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const response = await fetch(`/api/chat/settings?site_id=${siteId}`);
      if (!response.ok) {
        throw new Error('Failed to load settings');
      }
      const data = await response.json();
      setSettings({
        title: data.title || 'AI Assistant',
        welcome_message: data.welcome_message || 'Hello! I am your AI assistant. How can I help you today?',
        input_placeholder: data.input_placeholder || 'Type your message...',
        send_button_text: data.send_button_text || 'Send',
        avatar_url: data.avatar_url || null,
      });
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !siteId) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size must be less than 2MB');
      return;
    }

    try {
      setUploadingAvatar(true);

      // Convert to base64 for now (in production, upload to storage service)
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // For now, we'll store as data URL
        // In production, upload to Supabase Storage or similar
        const avatarUrl = base64String;

        // Update settings with new avatar URL
        const response = await fetch('/api/chat/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            site_id: siteId,
            ...settings,
            avatar_url: avatarUrl,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || 'Failed to upload avatar');
        }

        setSettings({ ...settings, avatar_url: avatarUrl });
        alert('Avatar uploaded successfully');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!siteId) return;

    try {
      setSaving(true);
      const response = await fetch('/api/chat/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_id: siteId,
          ...settings,
          avatar_url: null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to remove avatar');
      }

      setSettings({ ...settings, avatar_url: null });
    } catch (error) {
      console.error('Error removing avatar:', error);
      alert(error instanceof Error ? error.message : 'Failed to remove avatar');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (!siteId) {
      alert('Site ID is required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/chat/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_id: siteId,
          title: settings.title,
          welcome_message: settings.welcome_message,
          input_placeholder: settings.input_placeholder,
          send_button_text: settings.send_button_text,
          avatar_url: settings.avatar_url,
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Chat Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Chat Title
          </label>
          <input
            type="text"
            value={settings.title}
            onChange={(e) => setSettings({ ...settings, title: e.target.value })}
            placeholder="AI Assistant"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-sm text-gray-600 mt-1">
            The title displayed in the chat widget header
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Welcome Message
          </label>
          <textarea
            value={settings.welcome_message}
            onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
            placeholder="Hello! I am your AI assistant. How can I help you today?"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-sm text-gray-600 mt-1">
            The initial message shown when a user opens the chat
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Input Placeholder
          </label>
          <input
            type="text"
            value={settings.input_placeholder}
            onChange={(e) => setSettings({ ...settings, input_placeholder: e.target.value })}
            placeholder="Type your message..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-sm text-gray-600 mt-1">
            Placeholder text shown in the message input field
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Send Button Text
          </label>
          <input
            type="text"
            value={settings.send_button_text}
            onChange={(e) => setSettings({ ...settings, send_button_text: e.target.value })}
            placeholder="Send"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
          <p className="text-sm text-gray-600 mt-1">
            Text displayed on the send button
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Chat Avatar/Logo
          </label>
          <div className="flex items-start gap-4">
            {settings.avatar_url && (
              <div className="relative">
                <img
                  src={settings.avatar_url}
                  alt="Chat avatar"
                  className="w-16 h-16 rounded-full object-cover border-2 border-gray-300"
                />
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                  title="Remove avatar"
                >
                  ×
                </button>
              </div>
            )}
            <div className="flex-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
                id="avatar-upload"
              />
              <label
                htmlFor="avatar-upload"
                className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-md cursor-pointer hover:bg-gray-200 transition-colors"
              >
                {uploadingAvatar ? 'Uploading...' : settings.avatar_url ? 'Change Avatar' : 'Upload Avatar'}
              </label>
              <p className="text-sm text-gray-600 mt-2">
                Upload a circular logo or avatar to display in the chat header (max 2MB, recommended: 64x64px or larger)
              </p>
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
