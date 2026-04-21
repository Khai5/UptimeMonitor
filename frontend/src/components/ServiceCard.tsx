import { useState, useEffect, useRef } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaQuestionCircle, FaTrash, FaSync, FaCog, FaChevronDown, FaChevronUp, FaLock, FaGlobe } from 'react-icons/fa';
import { Service, DowntimeLog } from '../types';
import { adminApi } from '../api';
import DowntimeLogPanel from './DowntimeLogPanel';

interface ServiceCardProps {
  service: Service;
  password: string;
  isChecking?: boolean;
  onEdit: (service: Service) => void;
  onDelete: (id: number) => void;
  onCheckNow: (id: number) => void;
}

function ServiceCard({ service, password, isChecking = false, onEdit, onDelete, onCheckNow }: ServiceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [downtimeLog, setDowntimeLog] = useState<DowntimeLog | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [justUpdated, setJustUpdated] = useState(false);
  const prevLastCheckRef = useRef(service.last_check_at);

  // Detect when last_check_at changes and trigger highlight animation
  useEffect(() => {
    if (prevLastCheckRef.current !== service.last_check_at && prevLastCheckRef.current !== undefined) {
      setJustUpdated(true);
      const timer = setTimeout(() => setJustUpdated(false), 1500);
      return () => clearTimeout(timer);
    }
    prevLastCheckRef.current = service.last_check_at;
  }, [service.last_check_at]);

  const toggleExpand = async () => {
    if (!expanded && !downtimeLog) {
      setLoadingLog(true);
      try {
        const res = await adminApi.getDowntimeLog(password, service.id);
        setDowntimeLog(res.data);
      } catch (error) {
        console.error('Failed to fetch downtime log:', error);
      } finally {
        setLoadingLog(false);
      }
    }
    setExpanded(!expanded);
  };
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
    <div>
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
                {(service.verify_ssl === true || (service.verify_ssl as unknown) === 1) && (
                  <span className="inline-flex items-center gap-0.5 bg-blue-100 text-blue-700 text-xs px-1.5 py-0.5 rounded mr-1.5" title="SSL verification enabled">
                    <FaLock className="text-[10px]" /> SSL
                  </span>
                )}
                {(service.verify_domain === true || (service.verify_domain as unknown) === 1) && (
                  <span className="inline-flex items-center gap-0.5 bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded mr-1.5" title="Domain verification enabled">
                    <FaGlobe className="text-[10px]" /> DNS
                  </span>
                )}
                {service.url}
              </p>
              {service.last_check_at && (
                <p className={`text-xs mt-1 transition-colors duration-1000 ${justUpdated ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                  Last checked: {new Date(
                    service.last_check_at.endsWith('Z') || service.last_check_at.includes('+')
                      ? service.last_check_at
                      : service.last_check_at + 'Z'
                  ).toLocaleString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                    timeZoneName: 'short',
                  })}
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
                onClick={toggleExpand}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                title="Downtime logs"
              >
                {expanded ? <FaChevronUp /> : <FaChevronDown />}
              </button>
              <button
                onClick={() => onCheckNow(service.id)}
                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Check now"
                disabled={isChecking}
              >
                <FaSync className={isChecking ? 'animate-spin' : ''} />
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
      {expanded && (
        loadingLog ? (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center text-gray-500 text-sm">
            Loading downtime logs...
          </div>
        ) : downtimeLog ? (
          <DowntimeLogPanel log={downtimeLog} />
        ) : (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center text-gray-500 text-sm">
            Failed to load downtime logs.
          </div>
        )
      )}
    </div>
  );
}

export default ServiceCard;
