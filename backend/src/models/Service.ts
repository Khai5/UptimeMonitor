import db from '../database/schema';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type AlertType = 'unavailable' | 'not_contains_keyword' | 'contains_keyword' | 'http_status_other_than';

export interface Service {
  id?: number;
  name: string;
  url: string;
  http_method: HttpMethod;
  request_body?: string;
  request_headers?: string;
  follow_redirects: boolean;
  keep_cookies: boolean;
  check_interval: number;
  timeout: number;
  alert_type: AlertType;
  alert_keyword?: string;
  alert_http_statuses?: string;
  verify_ssl: boolean;
  ssl_expiry_threshold: number;
  verify_domain: boolean;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  last_check_at?: string;
  last_status_change_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceCheck {
  id?: number;
  service_id: number;
  status: 'operational' | 'degraded' | 'down';
  response_time?: number;
  status_code?: number;
  error_message?: string;
  ssl_valid?: boolean;
  ssl_expires_at?: string;
  ssl_issuer?: string;
  ssl_days_remaining?: number;
  domain_valid?: boolean;
  domain_error?: string;
  checked_at?: string;
}

export interface Incident {
  id?: number;
  service_id: number;
  started_at: string;
  resolved_at?: string;
  duration?: number;
  error_message?: string;
  notification_sent: boolean;
}

export interface DowntimeLog {
  service_id: number;
  total_incidents: number;
  resolved_incidents: number;
  active_incident: Incident | null;
  total_downtime_seconds: number;
  avg_downtime_seconds: number;
  longest_downtime_seconds: number;
  shortest_downtime_seconds: number;
  uptime_percentage: number;
  last_24h: { incidents: number; downtime_seconds: number };
  last_7d: { incidents: number; downtime_seconds: number };
  last_30d: { incidents: number; downtime_seconds: number };
  recent_incidents: Incident[];
}

export class ServiceModel {
  static create(service: Omit<Service, 'id'>): Service {
    const stmt = db.prepare(`
      INSERT INTO services (name, url, http_method, request_body, request_headers, follow_redirects, keep_cookies, check_interval, timeout, alert_type, alert_keyword, alert_http_statuses, verify_ssl, ssl_expiry_threshold, verify_domain, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      service.name,
      service.url,
      service.http_method || 'GET',
      service.request_body || null,
      service.request_headers || null,
      service.follow_redirects !== false ? 1 : 0,
      service.keep_cookies !== false ? 1 : 0,
      service.check_interval,
      service.timeout,
      service.alert_type || 'unavailable',
      service.alert_keyword || null,
      service.alert_http_statuses || null,
      service.verify_ssl ? 1 : 0,
      service.ssl_expiry_threshold || 30,
      service.verify_domain ? 1 : 0,
      service.status
    );

    return {
      id: result.lastInsertRowid as number,
      ...service,
    };
  }

  static getAll(): Service[] {
    const stmt = db.prepare('SELECT * FROM services ORDER BY created_at DESC');
    return stmt.all() as Service[];
  }

  static getById(id: number): Service | undefined {
    const stmt = db.prepare('SELECT * FROM services WHERE id = ?');
    return stmt.get(id) as Service | undefined;
  }

  static update(id: number, updates: Partial<Service>): void {
    const fields = Object.keys(updates)
      .filter(key => key !== 'id')
      .map(key => `${key} = ?`)
      .join(', ');

    // Convert boolean values to integers for SQLite compatibility
    const values = Object.entries(updates)
      .filter(([key]) => key !== 'id')
      .map(([key, value]) => {
        if (key === 'follow_redirects' || key === 'keep_cookies' || key === 'verify_ssl' || key === 'verify_domain') {
          return value ? 1 : 0;
        }
        return value;
      });

    if (fields.length === 0) {
      return; // Nothing to update
    }

    const stmt = db.prepare(`
      UPDATE services
      SET ${fields}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(...values, id);
  }

  static delete(id: number): void {
    const stmt = db.prepare('DELETE FROM services WHERE id = ?');
    stmt.run(id);
  }

  static updateStatus(id: number, status: Service['status']): void {
    const currentService = this.getById(id);
    const statusChanged = currentService && currentService.status !== status;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
      UPDATE services
      SET status = ?,
          last_check_at = ?,
          last_status_change_at = CASE WHEN ? THEN ? ELSE last_status_change_at END,
          updated_at = ?
      WHERE id = ?
    `);

    stmt.run(status, now, statusChanged ? 1 : 0, now, now, id);
  }
}

export class ServiceCheckModel {
  static create(check: Omit<ServiceCheck, 'id'>): ServiceCheck {
    const stmt = db.prepare(`
      INSERT INTO service_checks (service_id, status, response_time, status_code, error_message, ssl_valid, ssl_expires_at, ssl_issuer, ssl_days_remaining, domain_valid, domain_error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      check.service_id,
      check.status,
      check.response_time || null,
      check.status_code || null,
      check.error_message || null,
      check.ssl_valid != null ? (check.ssl_valid ? 1 : 0) : null,
      check.ssl_expires_at || null,
      check.ssl_issuer || null,
      check.ssl_days_remaining != null ? check.ssl_days_remaining : null,
      check.domain_valid != null ? (check.domain_valid ? 1 : 0) : null,
      check.domain_error || null
    );

    return {
      id: result.lastInsertRowid as number,
      ...check,
    };
  }

  static getByServiceId(serviceId: number, limit: number = 100): ServiceCheck[] {
    const stmt = db.prepare(`
      SELECT * FROM service_checks
      WHERE service_id = ?
      ORDER BY checked_at DESC
      LIMIT ?
    `);
    return stmt.all(serviceId, limit) as ServiceCheck[];
  }

  static getRecent(limit: number = 100): ServiceCheck[] {
    const stmt = db.prepare(`
      SELECT * FROM service_checks
      ORDER BY checked_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as ServiceCheck[];
  }
}

export class IncidentModel {
  static create(incident: Omit<Incident, 'id'>): Incident {
    const stmt = db.prepare(`
      INSERT INTO incidents (service_id, started_at, error_message, notification_sent)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(
      incident.service_id,
      incident.started_at,
      incident.error_message || null,
      incident.notification_sent ? 1 : 0
    );

    return {
      id: result.lastInsertRowid as number,
      ...incident,
    };
  }

  static getActiveByServiceId(serviceId: number): Incident | undefined {
    const stmt = db.prepare(`
      SELECT * FROM incidents
      WHERE service_id = ? AND resolved_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `);
    return stmt.get(serviceId) as Incident | undefined;
  }

  static resolve(id: number): void {
    const incident = db.prepare('SELECT * FROM incidents WHERE id = ?').get(id) as Incident;

    if (incident) {
      const startedAt = new Date(incident.started_at).getTime();
      const resolvedAt = new Date().getTime();
      const duration = Math.floor((resolvedAt - startedAt) / 1000); // Duration in seconds

      const stmt = db.prepare(`
        UPDATE incidents
        SET resolved_at = CURRENT_TIMESTAMP, duration = ?
        WHERE id = ?
      `);
      stmt.run(duration, id);
    }
  }

  static getByServiceId(serviceId: number, limit: number = 50): Incident[] {
    const stmt = db.prepare(`
      SELECT * FROM incidents
      WHERE service_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `);
    return stmt.all(serviceId, limit) as Incident[];
  }

  static getAll(limit: number = 50): Incident[] {
    const stmt = db.prepare(`
      SELECT * FROM incidents
      ORDER BY started_at DESC
      LIMIT ?
    `);
    return stmt.all(limit) as Incident[];
  }

  static markNotificationSent(id: number): void {
    const stmt = db.prepare('UPDATE incidents SET notification_sent = 1 WHERE id = ?');
    stmt.run(id);
  }

  static getDowntimeLogByServiceId(serviceId: number): DowntimeLog {
    const incidents = this.getByServiceId(serviceId, 1000);
    const service = ServiceModel.getById(serviceId);

    const totalIncidents = incidents.length;
    const resolvedIncidents = incidents.filter(i => i.resolved_at);
    const activeIncident = incidents.find(i => !i.resolved_at) || null;

    // Total downtime in seconds (resolved incidents)
    const totalDowntimeSeconds = resolvedIncidents.reduce((sum, i) => sum + (i.duration || 0), 0);

    // If there's an active incident, add its ongoing duration
    let currentDowntimeSeconds = 0;
    if (activeIncident) {
      currentDowntimeSeconds = Math.floor(
        (Date.now() - new Date(activeIncident.started_at).getTime()) / 1000
      );
    }

    const avgDowntimeSeconds = resolvedIncidents.length > 0
      ? Math.floor(totalDowntimeSeconds / resolvedIncidents.length)
      : 0;

    const longestDowntimeSeconds = resolvedIncidents.length > 0
      ? Math.max(...resolvedIncidents.map(i => i.duration || 0))
      : 0;

    const shortestDowntimeSeconds = resolvedIncidents.length > 0
      ? Math.min(...resolvedIncidents.map(i => i.duration || 0))
      : 0;

    // Uptime percentage: based on time since service was created
    let uptimePercentage = 100;
    if (service?.created_at) {
      const totalMonitoredSeconds = Math.floor(
        (Date.now() - new Date(service.created_at).getTime()) / 1000
      );
      if (totalMonitoredSeconds > 0) {
        const allDowntime = totalDowntimeSeconds + currentDowntimeSeconds;
        uptimePercentage = Math.max(0, Math.min(100,
          parseFloat(((1 - allDowntime / totalMonitoredSeconds) * 100).toFixed(3))
        ));
      }
    }

    // Last 24h stats
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const last24hIncidents = incidents.filter(i =>
      i.started_at >= twentyFourHoursAgo
    );
    const last24hDowntimeSeconds = last24hIncidents
      .filter(i => i.resolved_at)
      .reduce((sum, i) => sum + (i.duration || 0), 0);

    // Last 7d stats
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const last7dIncidents = incidents.filter(i =>
      i.started_at >= sevenDaysAgo
    );
    const last7dDowntimeSeconds = last7dIncidents
      .filter(i => i.resolved_at)
      .reduce((sum, i) => sum + (i.duration || 0), 0);

    // Last 30d stats
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const last30dIncidents = incidents.filter(i =>
      i.started_at >= thirtyDaysAgo
    );
    const last30dDowntimeSeconds = last30dIncidents
      .filter(i => i.resolved_at)
      .reduce((sum, i) => sum + (i.duration || 0), 0);

    return {
      service_id: serviceId,
      total_incidents: totalIncidents,
      resolved_incidents: resolvedIncidents.length,
      active_incident: activeIncident,
      total_downtime_seconds: totalDowntimeSeconds + currentDowntimeSeconds,
      avg_downtime_seconds: avgDowntimeSeconds,
      longest_downtime_seconds: longestDowntimeSeconds,
      shortest_downtime_seconds: shortestDowntimeSeconds,
      uptime_percentage: uptimePercentage,
      last_24h: {
        incidents: last24hIncidents.length,
        downtime_seconds: last24hDowntimeSeconds,
      },
      last_7d: {
        incidents: last7dIncidents.length,
        downtime_seconds: last7dDowntimeSeconds,
      },
      last_30d: {
        incidents: last30dIncidents.length,
        downtime_seconds: last30dDowntimeSeconds,
      },
      recent_incidents: incidents.slice(0, 10),
    };
  }
}

export class AppSettingsModel {
  static get(key: string): string | undefined {
    const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value;
  }

  static set(key: string, value: string): void {
    const stmt = db.prepare(`
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
    `);
    stmt.run(key, value, value);
  }

  static getAll(): Record<string, string> {
    const stmt = db.prepare('SELECT key, value FROM app_settings');
    const rows = stmt.all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }
}
