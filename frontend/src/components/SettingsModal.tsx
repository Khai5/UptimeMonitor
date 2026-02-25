import { useState, useEffect } from 'react';
import { adminApi } from '../api';
import { AdminUser } from '../types';

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

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [adminMsg, setAdminMsg] = useState('');
  const [adminMsgIsError, setAdminMsgIsError] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);

  useEffect(() => {
    loadSettings();
    loadAdmins();
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

  const loadAdmins = async () => {
    try {
      const res = await adminApi.getAdmins(password);
      setAdmins(res.data);
    } catch (error) {
      console.error('Failed to load admins:', error);
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

  const handleAddAdmin = async () => {
    setAdminMsg('');
    setAdminMsgIsError(false);
    if (!newUsername.trim()) {
      setAdminMsg('Username is required');
      setAdminMsgIsError(true);
      return;
    }
    if (newAdminPassword.length < 8) {
      setAdminMsg('Password must be at least 8 characters');
      setAdminMsgIsError(true);
      return;
    }
    setAddingAdmin(true);
    try {
      await adminApi.createAdmin(password, newUsername.trim(), newAdminPassword);
      setAdminMsg(`Admin "${newUsername.trim()}" created successfully.`);
      setNewUsername('');
      setNewAdminPassword('');
      await loadAdmins();
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to create admin';
      setAdminMsg(msg);
      setAdminMsgIsError(true);
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (id: number, username: string) => {
    if (!confirm(`Delete admin "${username}"? This cannot be undone.`)) return;
    try {
      await adminApi.deleteAdmin(password, id);
      await loadAdmins();
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to delete admin';
      alert(msg);
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
              Comma-separated email addresses to receive alerts. Changes take effect immediately
              after saving.
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

          {/* Admin Users */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Admin Users
            </h3>

            {/* Current admins list */}
            <div className="mb-3 border border-gray-200 rounded-md divide-y divide-gray-100">
              {admins.map((admin) => (
                <div key={admin.id} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-gray-800 font-medium">{admin.username}</span>
                  <button
                    onClick={() => handleDeleteAdmin(admin.id, admin.username)}
                    disabled={admins.length <= 1}
                    className="text-xs text-red-600 hover:text-red-800 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors"
                    title={admins.length <= 1 ? 'Cannot delete the last admin' : `Delete ${admin.username}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>

            {/* Add new admin */}
            <p className="text-xs text-gray-500 mb-2">Add a new admin user:</p>
            <div className="space-y-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Username"
              />
              <input
                type="password"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Password (min 8 characters)"
              />
              {adminMsg && (
                <p className={`text-sm ${adminMsgIsError ? 'text-red-600' : 'text-green-600'}`}>
                  {adminMsg}
                </p>
              )}
              <button
                onClick={handleAddAdmin}
                disabled={addingAdmin}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm disabled:opacity-50"
              >
                {addingAdmin ? 'Adding...' : 'Add Admin'}
              </button>
            </div>
          </div>

          {/* Change Own Password */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">
              Change Your Password
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
