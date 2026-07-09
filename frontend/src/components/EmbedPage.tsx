import { useState, useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaQuestionCircle, FaPauseCircle } from 'react-icons/fa';
import { PublicService, OverallStatus } from '../types';
import { publicApi } from '../api';

function EmbedPage() {
  const [services, setServices] = useState<PublicService[]>([]);
  const [overallStatus, setOverallStatus] = useState<OverallStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [servicesRes, statusRes] = await Promise.all([
        publicApi.getServices(),
        publicApi.getStatus(),
      ]);
      setServices(servicesRes.data);
      setOverallStatus(statusRes.data);
    } catch (error) {
      console.error('Error fetching embed data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string, size = 'text-sm', isPaused = false) => {
    if (isPaused) return <FaPauseCircle className={`text-gray-400 ${size}`} />;
    switch (status) {
      case 'operational':
        return <FaCheckCircle className={`text-green-500 ${size}`} />;
      case 'degraded':
        return <FaExclamationTriangle className={`text-yellow-500 ${size}`} />;
      case 'partial_outage':
        return <FaExclamationTriangle className={`text-orange-500 ${size}`} />;
      case 'down':
        return <FaTimesCircle className={`text-red-500 ${size}`} />;
      default:
        return <FaQuestionCircle className={`text-gray-400 ${size}`} />;
    }
  };

  const getOverallLabel = (status: string) => {
    switch (status) {
      case 'operational': return 'All systems operational';
      case 'degraded': return 'Some systems degraded';
      case 'partial_outage': return 'Partial outage detected';
      case 'down': return 'Outage detected';
      default: return 'Status unknown';
    }
  };

  const getStatusColor = (status: string, isPaused = false) => {
    if (isPaused) return 'text-gray-400';
    switch (status) {
      case 'operational': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'partial_outage': return 'text-orange-500';
      case 'down': return 'text-red-600';
      default: return 'text-gray-400';
    }
  };

  const getHeaderBg = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-50 border-green-100';
      case 'degraded': return 'bg-yellow-50 border-yellow-100';
      case 'partial_outage': return 'bg-orange-50 border-orange-100';
      case 'down': return 'bg-red-50 border-red-100';
      default: return 'bg-gray-50 border-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="font-sans text-sm bg-white border border-gray-200 rounded-lg p-4 text-center text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="font-sans text-sm bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Overall status header */}
      <div className={`px-4 py-2.5 border-b flex items-center gap-2 ${overallStatus ? getHeaderBg(overallStatus.status) : 'bg-gray-50 border-gray-100'}`}>
        {overallStatus && getStatusIcon(overallStatus.status, 'text-base')}
        <span className={`font-semibold text-sm ${overallStatus ? getStatusColor(overallStatus.status) : 'text-gray-500'}`}>
          {overallStatus ? getOverallLabel(overallStatus.status) : 'Loading...'}
        </span>
      </div>

      {/* Service list */}
      <div className="divide-y divide-gray-100">
        {services.length === 0 ? (
          <div className="px-4 py-3 text-gray-400 text-center text-xs">No services configured.</div>
        ) : (
          services.map((service) => (
            <div key={service.id} className="px-4 py-2 flex items-center justify-between">
              <span className="text-gray-700 text-xs">{service.name}</span>
              <div className="flex items-center gap-1.5">
                {getStatusIcon(service.status, 'text-xs', service.is_paused)}
                <span className={`text-xs font-medium ${getStatusColor(service.status, service.is_paused)}`}>
                  {service.is_paused ? 'Paused' : service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default EmbedPage;
