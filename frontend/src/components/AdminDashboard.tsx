import { useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaSignOutAlt, FaCog, FaEnvelope, FaUserClock, FaCode, FaTimes, FaClipboard, FaClipboardCheck } from 'react-icons/fa';
import { Service, OverallStatus } from '../types';
import ServiceCard from './ServiceCard';

function EmbedModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'iframe' | 'badge'>('iframe');
  const [copied, setCopied] = useState(false);

  const origin = window.location.origin;
  const iframeCode = `<iframe\n  src="${origin}/embed"\n  width="480"\n  height="300"\n  frameborder="0"\n  style="border-radius: 8px; border: 1px solid #e5e7eb;"\n  title="Service Status"\n></iframe>`;
  const badgeCode = `<iframe\n  src="${origin}/api/public/badge?theme=light"\n  width="220"\n  height="28"\n  frameborder="0"\n  scrolling="no"\n  title="Service Status Badge"\n></iframe>`;

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
              Add a live status badge that links to the full status page and updates automatically.
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
              <p className="text-xs text-gray-500 mb-2">Preview (click to open status page):</p>
              <iframe
                src={`${origin}/api/public/badge?theme=light`}
                width="220"
                height="28"
                frameBorder={0}
                scrolling="no"
                title="Service Status Badge"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface AdminDashboardProps {
  services: Service[];
  overallStatus: OverallStatus | null;
  password: string;
  checkingServiceId: number | null;
  onAddService: () => void;
  onEditService: (service: Service) => void;
  onDeleteService: (id: number) => void;
  onCheckNow: (id: number) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onTestEmail: () => void;
  onOpenOnCall: () => void;
}

function AdminDashboard({
  services,
  overallStatus,
  password,
  checkingServiceId,
  onAddService,
  onEditService,
  onDeleteService,
  onCheckNow,
  onLogout,
  onOpenSettings,
  onTestEmail,
  onOpenOnCall,
}: AdminDashboardProps) {
  const [showEmbedModal, setShowEmbedModal] = useState(false);

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
    if (overallStatus.status === 'operational') return 'All services are online';
    if (overallStatus.status === 'degraded') return 'Some services are degraded';
    return 'Some services are down';
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
      {/* Admin bar */}
      <div className="flex justify-between items-center mb-6 bg-gray-800 text-white px-4 py-3 rounded-lg">
        <span className="font-medium">Admin Mode</span>
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenOnCall}
            className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded transition-colors text-sm"
            title="On-call management"
          >
            <FaUserClock />
            <span>On-Call</span>
          </button>
          <button
            onClick={onTestEmail}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm"
            title="Send test alert email"
          >
            <FaEnvelope />
            <span>Test Email</span>
          </button>
          <button
            onClick={() => setShowEmbedModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm"
            title="Embed status page"
          >
            <FaCode />
            <span>Embed</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm"
            title="Settings"
          >
            <FaCog />
            <span>Settings</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center space-x-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded transition-colors text-sm"
          >
            <FaSignOutAlt />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {showEmbedModal && <EmbedModal onClose={() => setShowEmbedModal(false)} />}

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
                password={password}
                isChecking={checkingServiceId === service.id}
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

export default AdminDashboard;
