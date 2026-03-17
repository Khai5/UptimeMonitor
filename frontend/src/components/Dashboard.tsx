import { useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaSearch, FaSort } from 'react-icons/fa';
import { Service, OverallStatus } from '../types';
import ServiceCard from './ServiceCard';

interface DashboardProps {
  services: Service[];
  overallStatus: OverallStatus | null;
  password: string;
  onAddService: () => void;
  onEditService: (service: Service) => void;
  onDeleteService: (id: number) => void;
  onCheckNow: (id: number) => void;
}

type SortOption = 'name_asc' | 'name_desc' | 'status' | 'last_checked';

const STATUS_ORDER: Record<string, number> = { down: 0, degraded: 1, unknown: 2, operational: 3 };

function Dashboard({
  services,
  overallStatus,
  password,
  onAddService,
  onEditService,
  onDeleteService,
  onCheckNow,
}: DashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');

  const getStatusIcon = () => {
    if (!overallStatus) return null;

    switch (overallStatus.status) {
      case 'operational':
        return <FaCheckCircle className="text-5xl text-green-600" />;
      case 'degraded':
        return <FaExclamationTriangle className="text-5xl text-yellow-600" />;
      case 'down':
        return <FaTimesCircle className="text-5xl text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    if (!overallStatus) return 'Loading...';

    if (overallStatus.status === 'operational') {
      return 'All services are online';
    } else if (overallStatus.status === 'degraded') {
      return 'Some services are degraded';
    } else {
      return 'Some services are down';
    }
  };

  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
  };

  const filteredAndSortedServices = [...services]
    .filter((s) => {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.url.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name);
        case 'name_desc':
          return b.name.localeCompare(a.name);
        case 'status':
          return (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
        case 'last_checked':
          return (b.last_check_at ?? '').localeCompare(a.last_check_at ?? '');
        default:
          return 0;
      }
    });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex justify-center mb-4">{getStatusIcon()}</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{getStatusText()}</h1>
        {overallStatus && (
          <p className="text-gray-600">
            Last updated on {formatLastUpdated(overallStatus.last_updated)}
          </p>
        )}
      </div>

      {/* Stats */}
      {overallStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              {overallStatus.total_services}
            </div>
            <div className="text-sm text-gray-600">Total Services</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {overallStatus.operational}
            </div>
            <div className="text-sm text-gray-600">Operational</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {overallStatus.degraded}
            </div>
            <div className="text-sm text-gray-600">Degraded</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{overallStatus.down}</div>
            <div className="text-sm text-gray-600">Down</div>
          </div>
        </div>
      )}

      {/* Services */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Current status by service</h2>
          <button
            onClick={onAddService}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Service
          </button>
        </div>

        {/* Search and Sort controls */}
        {services.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 px-6 py-3 border-b border-gray-100 bg-gray-50">
            <div className="relative flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
              <input
                type="text"
                placeholder="Search by name or URL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <FaSort className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white appearance-none cursor-pointer"
              >
                <option value="name_asc">Name (A–Z)</option>
                <option value="name_desc">Name (Z–A)</option>
                <option value="status">Status (worst first)</option>
                <option value="last_checked">Last checked</option>
              </select>
            </div>
          </div>
        )}

        <div className="divide-y divide-gray-200">
          {services.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No services configured. Click "Add Service" to get started.
            </div>
          ) : filteredAndSortedServices.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No services match your search.
            </div>
          ) : (
            filteredAndSortedServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                password={password}
                onEdit={onEditService}
                onDelete={onDeleteService}
                onCheckNow={onCheckNow}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
