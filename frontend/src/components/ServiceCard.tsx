import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaQuestionCircle, FaTrash, FaSync, FaCog } from 'react-icons/fa';
import { Service } from '../types';

interface ServiceCardProps {
  service: Service;
  onEdit: (service: Service) => void;
  onDelete: (id: number) => void;
  onCheckNow: (id: number) => void;
}

function ServiceCard({ service, onEdit, onDelete, onCheckNow }: ServiceCardProps) {
  const getStatusColor = () => {
    switch (service.status) {
      case 'operational':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusIcon = () => {
    switch (service.status) {
      case 'operational':
        return <FaCheckCircle className={`${getStatusColor()} text-xl`} />;
      case 'degraded':
        return <FaExclamationTriangle className={`${getStatusColor()} text-xl`} />;
      case 'down':
        return <FaTimesCircle className={`${getStatusColor()} text-xl`} />;
      default:
        return <FaQuestionCircle className={`${getStatusColor()} text-xl`} />;
    }
  };

  const getStatusText = () => {
    return service.status.charAt(0).toUpperCase() + service.status.slice(1);
  };

  return (
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex-shrink-0">{getStatusIcon()}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-medium text-gray-900 truncate">
              {service.name}
            </h3>
            <p className="text-sm text-gray-500 truncate">
              {service.http_method && service.http_method !== 'GET' && (
                <span className="inline-block bg-gray-200 text-gray-700 text-xs font-mono px-1.5 py-0.5 rounded mr-1.5">
                  {service.http_method}
                </span>
              )}
              {service.url}
            </p>
            {service.last_check_at && (
              <p className="text-xs text-gray-400 mt-1">
                Last checked: {new Date(service.last_check_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <span className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => onCheckNow(service.id)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Check now"
            >
              <FaSync />
            </button>
            <button
              onClick={() => onEdit(service)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Edit service"
            >
              <FaCog />
            </button>
            <button
              onClick={() => onDelete(service.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete service"
            >
              <FaTrash />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServiceCard;
