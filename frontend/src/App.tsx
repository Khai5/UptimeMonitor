import { useState, useEffect } from 'react';
import { Service, PublicService, OverallStatus } from './types';
import { publicApi, authApi, adminApi } from './api';
import PublicDashboard from './components/PublicDashboard';
import AdminDashboard from './components/AdminDashboard';
import AdminLogin from './components/AdminLogin';
import AddServiceModal from './components/AddServiceModal';
import EditServiceModal from './components/EditServiceModal';
import SettingsModal from './components/SettingsModal';

function App() {
  // Determine mode from URL path
  const isAdminPath = window.location.pathname.startsWith('/admin');

  const [mode, setMode] = useState<'public' | 'admin-login' | 'admin'>(
    isAdminPath ? 'admin-login' : 'public'
  );
  const [adminPassword, setAdminPassword] = useState<string>('');

  // Public state
  const [publicServices, setPublicServices] = useState<PublicService[]>([]);
  const [publicStatus, setPublicStatus] = useState<OverallStatus | null>(null);

  // Admin state
  const [services, setServices] = useState<Service[]>([]);
  const [overallStatus, setOverallStatus] = useState<OverallStatus | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loginError, setLoginError] = useState('');

  // Public data fetch
  const fetchPublicData = async () => {
    try {
      const [servicesRes, statusRes] = await Promise.all([
        publicApi.getServices(),
        publicApi.getStatus(),
      ]);
      setPublicServices(servicesRes.data);
      setPublicStatus(statusRes.data);
    } catch (error) {
      console.error('Error fetching public data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Admin data fetch
  const fetchAdminData = async () => {
    if (!adminPassword) return;
    try {
      const [servicesRes, statusRes] = await Promise.all([
        adminApi.getServices(adminPassword),
        adminApi.getStatus(adminPassword),
      ]);
      setServices(servicesRes.data);
      setOverallStatus(statusRes.data);
    } catch (error: any) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        setMode('admin-login');
        setAdminPassword('');
        setLoginError('Session expired. Please log in again.');
      }
      console.error('Error fetching admin data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'public') {
      fetchPublicData();
      const interval = setInterval(fetchPublicData, 30000);
      return () => clearInterval(interval);
    } else if (mode === 'admin') {
      fetchAdminData();
      const interval = setInterval(fetchAdminData, 30000);
      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
    }
  }, [mode, adminPassword]);

  const handleLogin = async (password: string) => {
    try {
      setLoginError('');
      const res = await authApi.login(password);
      if (res.data.success) {
        setAdminPassword(password);
        setMode('admin');
        setIsLoading(true);
      }
    } catch (error: any) {
      if (error?.response?.status === 403) {
        setLoginError('Invalid password');
      } else {
        setLoginError('Login failed');
      }
    }
  };

  const handleLogout = () => {
    setAdminPassword('');
    setMode('public');
    setServices([]);
    setOverallStatus(null);
    window.history.pushState({}, '', '/');
  };

  const handleAddService = async (service: Partial<Service>) => {
    try {
      await adminApi.createService(adminPassword, service);
      await fetchAdminData();
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding service:', error);
      alert('Failed to add service');
    }
  };

  const handleEditService = async (id: number, updates: Partial<Service>) => {
    try {
      await adminApi.updateService(adminPassword, id, updates);
      await fetchAdminData();
      setEditingService(null);
    } catch (error) {
      console.error('Error updating service:', error);
      alert('Failed to update service');
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    try {
      await adminApi.deleteService(adminPassword, id);
      await fetchAdminData();
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Failed to delete service');
    }
  };

  const handleCheckNow = async (id: number) => {
    try {
      await adminApi.checkNow(adminPassword, id);
      await fetchAdminData();
    } catch (error) {
      console.error('Error checking service:', error);
      alert('Failed to check service');
    }
  };

  const handleTestEmail = async () => {
    try {
      await adminApi.sendTestEmail(adminPassword);
      alert('Test email sent successfully!');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to send test email';
      alert(msg);
    }
  };

  if (isLoading && mode !== 'admin-login') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Public view mode
  if (mode === 'public') {
    return (
      <div className="min-h-screen bg-gray-50">
        <PublicDashboard
          services={publicServices}
          overallStatus={publicStatus}
        />
      </div>
    );
  }

  // Admin login
  if (mode === 'admin-login') {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminLogin onLogin={handleLogin} error={loginError} />
      </div>
    );
  }

  // Admin mode
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminDashboard
        services={services}
        overallStatus={overallStatus}
        onAddService={() => setIsAddModalOpen(true)}
        onEditService={(service) => setEditingService(service)}
        onDeleteService={handleDeleteService}
        onCheckNow={handleCheckNow}
        onLogout={handleLogout}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onTestEmail={handleTestEmail}
      />

      {isAddModalOpen && (
        <AddServiceModal
          onClose={() => setIsAddModalOpen(false)}
          onAdd={handleAddService}
        />
      )}

      {editingService && (
        <EditServiceModal
          service={editingService}
          onClose={() => setEditingService(null)}
          onSave={handleEditService}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          password={adminPassword}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
