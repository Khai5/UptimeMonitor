import { FaClock, FaExclamationCircle, FaArrowUp, FaChartBar } from 'react-icons/fa';
import { DowntimeLog, Incident } from '../types';

interface DowntimeLogPanelProps {
  log: DowntimeLog;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 && days === 0) parts.push(`${secs}s`);
  return parts.join(' ');
}

function formatTimestamp(ts: string): string {
  const date = new Date(
    ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z'
  );
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function IncidentRow({ incident }: { incident: Incident }) {
  const isActive = !incident.resolved_at;
  const duration = isActive
    ? Math.floor((Date.now() - new Date(incident.started_at).getTime()) / 1000)
    : incident.duration || 0;

  return (
    <div className={`text-xs border-l-2 pl-3 py-1.5 ${isActive ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
      <div className="flex justify-between items-start">
        <div>
          <span className={`font-medium ${isActive ? 'text-red-700' : 'text-gray-700'}`}>
            {isActive ? 'ONGOING' : 'Resolved'}
          </span>
          <span className="text-gray-500 ml-2">{formatTimestamp(incident.started_at)}</span>
          {incident.resolved_at && (
            <span className="text-gray-500"> - {formatTimestamp(incident.resolved_at)}</span>
          )}
        </div>
        <span className="text-gray-600 font-mono">{formatDuration(duration)}</span>
      </div>
      {incident.error_message && (
        <p className="text-gray-500 mt-0.5 truncate" title={incident.error_message}>
          {incident.error_message}
        </p>
      )}
    </div>
  );
}

function DowntimeLogPanel({ log }: DowntimeLogPanelProps) {
  return (
    <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
      {/* Summary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded p-3 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <FaArrowUp className="text-green-500" />
            <span>Uptime</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{log.uptime_percentage}%</div>
        </div>
        <div className="bg-white rounded p-3 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <FaExclamationCircle className="text-red-500" />
            <span>Total Incidents</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{log.total_incidents}</div>
        </div>
        <div className="bg-white rounded p-3 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <FaClock className="text-yellow-500" />
            <span>Total Downtime</span>
          </div>
          <div className="text-lg font-bold text-gray-900">{formatDuration(log.total_downtime_seconds)}</div>
        </div>
        <div className="bg-white rounded p-3 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 text-xs mb-1">
            <FaChartBar className="text-blue-500" />
            <span>Avg Downtime</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {log.resolved_incidents > 0 ? formatDuration(log.avg_downtime_seconds) : '-'}
          </div>
        </div>
      </div>

      {/* Time-range breakdown */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded p-3 shadow-sm text-center">
          <div className="text-xs text-gray-500 mb-1">Last 24 hours</div>
          <div className="text-sm font-semibold text-gray-800">{log.last_24h.incidents} incident{log.last_24h.incidents !== 1 ? 's' : ''}</div>
          <div className="text-xs text-gray-500">{formatDuration(log.last_24h.downtime_seconds)} down</div>
        </div>
        <div className="bg-white rounded p-3 shadow-sm text-center">
          <div className="text-xs text-gray-500 mb-1">Last 7 days</div>
          <div className="text-sm font-semibold text-gray-800">{log.last_7d.incidents} incident{log.last_7d.incidents !== 1 ? 's' : ''}</div>
          <div className="text-xs text-gray-500">{formatDuration(log.last_7d.downtime_seconds)} down</div>
        </div>
        <div className="bg-white rounded p-3 shadow-sm text-center">
          <div className="text-xs text-gray-500 mb-1">Last 30 days</div>
          <div className="text-sm font-semibold text-gray-800">{log.last_30d.incidents} incident{log.last_30d.incidents !== 1 ? 's' : ''}</div>
          <div className="text-xs text-gray-500">{formatDuration(log.last_30d.downtime_seconds)} down</div>
        </div>
      </div>

      {/* Duration extremes */}
      {log.resolved_incidents > 0 && (
        <div className="flex space-x-4 mb-4 text-xs text-gray-600">
          <span>Longest outage: <strong>{formatDuration(log.longest_downtime_seconds)}</strong></span>
          <span>Shortest outage: <strong>{formatDuration(log.shortest_downtime_seconds)}</strong></span>
        </div>
      )}

      {/* Recent incidents list */}
      {log.recent_incidents.length > 0 ? (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Recent Incidents ({log.recent_incidents.length})
          </h4>
          <div className="space-y-1">
            {log.recent_incidents.map((incident) => (
              <IncidentRow key={incident.id} incident={incident} />
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500">No downtime incidents recorded.</p>
      )}
    </div>
  );
}

export default DowntimeLogPanel;
