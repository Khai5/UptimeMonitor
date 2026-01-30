import { useState, useEffect } from 'react';
import { adminApi } from '../api';

interface SettingsModalProps {
  password: string;
  onClose: () => void;
}

function SettingsModal({ password, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const res = await adminApi.getSettings(password);
      setSettings(res.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateSettings(password, settings);
      alert('Settings saved.');
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordMsg('');
    if (newPassword.length < 8) {
      setPasswordMsg('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match');
      return;
    }
    try {
      await adminApi.changePassword(password, newPassword);
      setPasswordMsg('Password changed. You will need to use the new password next time.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordMsg('Failed to change password');
    }
  };

  const updateSetting = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Alert Email Recipients */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Alert Email Recipients
            </h3>
            <p className="text-xs text-gray-500 mb-2">
              Comma-separated email addresses to receive alerts. These are configured via the
              EMAIL_TO environment variable on the server. The value shown here is for reference.
            </p>
            <input
              type="text"
              value={settings['alert_emails'] || ''}
              onChange={(e) => updateSetting('alert_emails', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@example.com, ops@example.com"
            />
            <p className="text-xs text-gray-400 mt-1">
              Note: For email delivery to work, MAILGUN or SMTP must be configured in the server environment.
            </p>
          </div>

          {/* Change Password */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Change Admin Password
            </h3>
            <div className="space-y-2">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="New password (min 8 characters)"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Confirm new password"
              />
              {passwordMsg && (
                <p className={`text-sm ${passwordMsg.includes('changed') ? 'text-green-600' : 'text-red-600'}`}>
                  {passwordMsg}
                </p>
              )}
              <button
                onClick={handleChangePassword}
                className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors text-sm"
              >
                Change Password
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
