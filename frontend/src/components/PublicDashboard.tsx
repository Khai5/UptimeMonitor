import { useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaQuestionCircle, FaCode, FaTimes, FaClipboard, FaClipboardCheck } from 'react-icons/fa';
import { PublicService, OverallStatus } from '../types';

interface PublicDashboardProps {
  services: PublicService[];
  overallStatus: OverallStatus | null;
}

function EmbedModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'iframe' | 'badge'>('iframe');
  const [copied, setCopied] = useState(false);

  const origin = window.location.origin;
  const iframeCode = `<iframe\n  src="${origin}/embed"\n  width="480"\n  height="300"\n  frameborder="0"\n  style="border-radius: 8px; border: 1px solid #e5e7eb;"\n  title="Service Status"\n></iframe>`;
  const badgeCode = `<img src="${origin}/api/public/badge" alt="Service Status" />`;

  const currentCode = activeTab === 'iframe' ? iframeCode : badgeCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FaCode className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Embed Status Page</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FaTimes />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6">
          <button
            className={`py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors ${activeTab === 'iframe' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setActiveTab('iframe'); setCopied(false); }}
          >
            Iframe Embed
          </button>
          <button
            className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'badge' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => { setActiveTab('badge'); setCopied(false); }}
          >
            Status Badge
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {activeTab === 'iframe' ? (
            <p className="text-sm text-gray-600 mb-3">
              Embed the full status page in any website using an iframe.
            </p>
          ) : (
            <p className="text-sm text-gray-600 mb-3">
              Add a live status badge that updates automatically.
            </p>
          )}

          {/* Code block */}
          <div className="relative">
            <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 text-xs overflow-x-auto whitespace-pre-wrap break-all font-mono">
              {currentCode}
            </pre>
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-xs transition-colors"
            >
              {copied ? <FaClipboardCheck className="text-green-400" /> : <FaClipboard />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Badge preview */}
          {activeTab === 'badge' && (
            <div className="mt-4">
              <p className="text-xs text-gray-500 mb-2">Preview:</p>
              <img src={`${origin}/api/public/badge`} alt="Service Status" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PublicDashboard({ services, overallStatus }: PublicDashboardProps) {
  const [showEmbedModal, setShowEmbedModal] = useState(false);
  const getOverallStatusIcon = () => {
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
    if (overallStatus.status === 'operational') return 'All services are online';
    if (overallStatus.status === 'degraded') return 'Some services are degraded';
    return 'Some services are down';
  };

  const getServiceStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <FaCheckCircle className="text-green-600 text-lg" />;
      case 'degraded':
        return <FaExclamationTriangle className="text-yellow-600 text-lg" />;
      case 'down':
        return <FaTimesCircle className="text-red-600 text-lg" />;
      default:
        return <FaQuestionCircle className="text-gray-400 text-lg" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-400';
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
      <div className="text-center mb-8 relative">
        <div className="flex justify-center mb-4">{getOverallStatusIcon()}</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{getStatusText()}</h1>
        {overallStatus && (
          <p className="text-gray-600">
            Last updated on {formatLastUpdated(overallStatus.last_updated)}
          </p>
        )}
        <button
          onClick={() => setShowEmbedModal(true)}
          className="absolute top-0 right-0 flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 hover:border-gray-400 rounded-lg bg-white transition-colors"
        >
          <FaCode className="text-xs" />
          Embed
        </button>
      </div>

      {showEmbedModal && <EmbedModal onClose={() => setShowEmbedModal(false)} />}

      {/* Stats */}
      {overallStatus && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{overallStatus.total_services}</div>
            <div className="text-sm text-gray-600">Total Services</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{overallStatus.operational}</div>
            <div className="text-sm text-gray-600">Operational</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{overallStatus.degraded}</div>
            <div className="text-sm text-gray-600">Degraded</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{overallStatus.down}</div>
            <div className="text-sm text-gray-600">Down</div>
          </div>
        </div>
      )}

      {/* Services list — name and status only */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Current status by service</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {services.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No services configured.
            </div>
          ) : (
            services.map((service) => (
              <div key={service.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getServiceStatusIcon(service.status)}
                    <span className="text-base font-medium text-gray-900">{service.name}</span>
                  </div>
                  <span className={`text-sm font-medium ${getStatusColor(service.status)}`}>
                    {service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default PublicDashboard;
