/**
 * General Settings Page
 * 
 * User preferences like time format
 */

'use client';

import { useState, useEffect } from 'react';
import { getTimeFormat, setTimeFormat } from '@/lib/utils/date-format';

export default function GeneralSettingsPage() {
  const [timeFormat, setTimeFormatState] = useState<'12h' | '24h'>('24h');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load current preference
    const currentFormat = getTimeFormat();
    setTimeFormatState(currentFormat);
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      setTimeFormat(timeFormat);
      alert('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">General Settings</h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Time Format */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Time Format
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="timeFormat"
                value="12h"
                checked={timeFormat === '12h'}
                onChange={(e) => setTimeFormatState('12h')}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-gray-900">12-hour format (3:45 PM)</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="timeFormat"
                value="24h"
                checked={timeFormat === '24h'}
                onChange={(e) => setTimeFormatState('24h')}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-gray-900">24-hour format (15:45)</span>
            </label>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            This setting affects how dates and times are displayed throughout the dashboard.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-6 border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
