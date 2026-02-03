import { useState } from 'react';
import { HttpMethod, Service } from '../types';

interface EditServiceModalProps {
  service: Service;
  onClose: () => void;
  onSave: (id: number, updates: Partial<Service>) => void;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const TIMEOUT_OPTIONS = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
];

interface HeaderPair {
  name: string;
  value: string;
}

function parseHeadersToArray(headersJson?: string): HeaderPair[] {
  if (!headersJson) {
    return [
      { name: '', value: '' },
      { name: '', value: '' },
      { name: '', value: '' },
    ];
  }

  try {
    const parsed = JSON.parse(headersJson);
    const pairs: HeaderPair[] = Object.entries(parsed).map(([name, value]) => ({
      name,
      value: String(value),
    }));
    // Ensure at least 3 rows
    while (pairs.length < 3) {
      pairs.push({ name: '', value: '' });
    }
    return pairs;
  } catch {
    return [
      { name: '', value: '' },
      { name: '', value: '' },
      { name: '', value: '' },
    ];
  }
}

function EditServiceModal({ service, onClose, onSave }: EditServiceModalProps) {
  const [formData, setFormData] = useState({
    name: service.name,
    url: service.url,
    http_method: service.http_method || 'GET' as HttpMethod,
    request_body: service.request_body || '',
    follow_redirects: service.follow_redirects !== false && (service.follow_redirects as unknown) !== 0,
    keep_cookies: service.keep_cookies !== false && (service.keep_cookies as unknown) !== 0,
    check_interval: service.check_interval,
    timeout: service.timeout,
  });

  const [headers, setHeaders] = useState<HeaderPair[]>(
    parseHeadersToArray(service.request_headers)
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.url) {
      alert('Name and URL are required');
      return;
    }

    // Convert header pairs to JSON object
    const headersObj: Record<string, string> = {};
    headers.forEach(h => {
      if (h.name.trim() && h.value.trim()) {
        headersObj[h.name.trim()] = h.value.trim();
      }
    });

    const requestHeaders = Object.keys(headersObj).length > 0
      ? JSON.stringify(headersObj)
      : undefined;

    onSave(service.id, {
      ...formData,
      request_body: formData.request_body || undefined,
      request_headers: requestHeaders,
    });
  };

  const updateHeader = (index: number, field: 'name' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    setHeaders(newHeaders);
  };

  const addHeaderRow = () => {
    setHeaders([...headers, { name: '', value: '' }]);
  };

  const showBodyFields = ['POST', 'PUT', 'PATCH'].includes(formData.http_method);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit Service</h2>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Service Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., My API Service"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL *</label>
              <input
                type="url"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com/api/health"
                required
              />
            </div>

            {/* Request Parameters Section */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Request parameters</h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HTTP method used to make the request
                  </label>
                  <select
                    value={formData.http_method}
                    onChange={(e) =>
                      setFormData({ ...formData, http_method: e.target.value as HttpMethod })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {HTTP_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Request timeout
                  </label>
                  <select
                    value={formData.timeout}
                    onChange={(e) =>
                      setFormData({ ...formData, timeout: parseInt(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TIMEOUT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This includes both open & read timeout.
                  </p>
                </div>
              </div>

              {showBodyFields && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Request body for POST, PUT, and PATCH requests
                  </label>
                  <textarea
                    value={formData.request_body}
                    onChange={(e) => setFormData({ ...formData, request_body: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder='parameter1=first_value&parameter2=another_value'
                    rows={4}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    You can use {'{timestamp}'} in the body to bust the cache. Example: {`{"t": {timestamp}}`}
                  </p>
                </div>
              )}

              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.follow_redirects}
                    onChange={(e) => setFormData({ ...formData, follow_redirects: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Follow redirects</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.keep_cookies}
                    onChange={(e) => setFormData({ ...formData, keep_cookies: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Keep cookies when redirecting</span>
                </label>
              </div>
            </div>

            {/* Request Headers Section */}
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Request headers</h3>

              <div className="space-y-3">
                {headers.map((header, index) => (
                  <div key={index} className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Header name {index + 1}
                      </label>
                      <input
                        type="text"
                        value={header.name}
                        onChange={(e) => updateHeader(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={index === 0 ? 'Content-Type' : index === 1 ? 'Authorization' : 'Referer'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        Header value {index + 1}
                      </label>
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) => updateHeader(index, 'value', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={index === 0 ? 'application/json' : index === 1 ? 'Bearer your-token' : 'https://example.com'}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addHeaderRow}
                className="mt-3 text-sm text-blue-600 hover:text-blue-800"
              >
                + Add another header
              </button>
            </div>

            {/* Check Interval */}
            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Check Interval (seconds)
              </label>
              <input
                type="number"
                value={formData.check_interval}
                onChange={(e) =>
                  setFormData({ ...formData, check_interval: parseInt(e.target.value) })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="30"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Default: 900 (15 minutes). Minimum: 30 seconds.
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditServiceModal;
