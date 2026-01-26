import { useState, useEffect } from 'react';
import { Service, OverallStatus } from './types';
import { servicesApi, statusApi } from './api';
import Dashboard from './components/Dashboard';
import AddServiceModal from './components/AddServiceModal';
import EditServiceModal from './components/EditServiceModal';

function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [overallStatus, setOverallStatus] = useState<OverallStatus | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [servicesRes, statusRes] = await Promise.all([
        servicesApi.getAll(),
        statusApi.getOverall(),
      ]);
      setServices(servicesRes.data);
      setOverallStatus(statusRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Refresh data every 30 seconds
    const interval = setInterval(fetchData, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleAddService = async (service: Partial<Service>) => {
    try {
      await servicesApi.create(service);
      await fetchData();
      setIsAddModalOpen(false);
    } catch (error) {
      console.error('Error adding service:', error);
      alert('Failed to add service');
    }
  };

  const handleEditService = async (id: number, updates: Partial<Service>) => {
    try {
      await servicesApi.update(id, updates);
      await fetchData();
      setEditingService(null);
    } catch (error) {
      console.error('Error updating service:', error);
      alert('Failed to update service');
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm('Are you sure you want to delete this service?')) return;

    try {
      await servicesApi.delete(id);
      await fetchData();
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Failed to delete service');
    }
  };

  const handleCheckNow = async (id: number) => {
    try {
      await servicesApi.checkNow(id);
      await fetchData();
    } catch (error) {
      console.error('Error checking service:', error);
      alert('Failed to check service');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Dashboard
        services={services}
        overallStatus={overallStatus}
        onAddService={() => setIsAddModalOpen(true)}
        onEditService={(service) => setEditingService(service)}
        onDeleteService={handleDeleteService}
        onCheckNow={handleCheckNow}
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
    </div>
  );
}

export default App;
