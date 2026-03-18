import { useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaTimesCircle, FaSignOutAlt, FaCog, FaEnvelope, FaUserClock, FaCode, FaTimes, FaClipboard, FaClipboardCheck, FaSearch, FaSort, FaFileExport, FaDownload } from 'react-icons/fa';
import { adminApi } from '../api';

type SortOption = 'name_asc' | 'name_desc' | 'status' | 'last_checked';
const STATUS_ORDER: Record<string, number> = { down: 0, degraded: 1, unknown: 2, operational: 3 };
import { Service, OverallStatus } from '../types';
import ServiceCard from './ServiceCard';

function ExportModal({ password, onClose }: { password: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function buildExport() {
    const servicesRes = await adminApi.getServices(password);
    return {
      exported_at: new Date().toISOString(),
      services: servicesRes.data,
    };
  }

  const handleDownload = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await buildExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uptime-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Failed to fetch data for export.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    setLoading(true);
    setError('');
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // Safari requires clipboard access within the user gesture context.
        // Passing a Promise to ClipboardItem keeps that context alive while
        // the async fetch resolves.
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': buildExport().then(
              data => new Blob([JSON.stringify(data, null, 2)], { type: 'text/plain' })
            ),
          }),
        ]);
      } else {
        const data = await buildExport();
        const text = JSON.stringify(data, null, 2);
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FaFileExport className="text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Export Data</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <FaTimes />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-600 mb-5">
            Export all services as a JSON snapshot.
          </p>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <FaDownload />
              {loading ? 'Loading…' : 'Download JSON'}
            </button>
            <button
              onClick={handleCopy}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {copied ? <FaClipboardCheck className="text-green-400" /> : <FaClipboard />}
              {copied ? 'Copied!' : 'Copy to Clipboard'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbedModal({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'iframe' | 'badge'>('iframe');
  const [copied, setCopied] = useState(false);

  const origin = window.location.origin;
  const iframeCode = `<iframe\n  src="${origin}/embed"\n  width="480"\n  height="300"\n  frameborder="0"\n  style="border-radius: 8px; border: 1px solid #e5e7eb;"\n  title="Service Status"\n></iframe>`;
  const badgeCode = `<iframe\n  src="${origin}/api/public/badge?theme=light"\n  width="220"\n  height="28"\n  frameborder="0"\n  scrolling="no"\n  title="Service Status Badge"\n></iframe>`;

  const currentCode = activeTab === 'iframe' ? iframeCode : badgeCode;

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(currentCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(currentCode);
      });
    } else {
      fallbackCopy(currentCode);
    }
  };

  function fallbackCopy(text: string) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

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
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');

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
            onClick={() => setShowExportModal(true)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors text-sm"
            title="Export data as JSON"
          >
            <FaFileExport />
            <span>Export</span>
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
      {showExportModal && <ExportModal password={password} onClose={() => setShowExportModal(false)} />}

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
