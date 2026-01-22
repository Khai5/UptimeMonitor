import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import { Service, OverallStatus } from '../types';
import ServiceCard from './ServiceCard';

interface DashboardProps {
  services: Service[];
  overallStatus: OverallStatus | null;
  onAddService: () => void;
  onDeleteService: (id: number) => void;
  onCheckNow: (id: number) => void;
}

function Dashboard({
  services,
  overallStatus,
  onAddService,
  onDeleteService,
  onCheckNow,
}: DashboardProps) {
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

        <div className="divide-y divide-gray-200">
          {services.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No services configured. Click "Add Service" to get started.
            </div>
          ) : (
            services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
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
