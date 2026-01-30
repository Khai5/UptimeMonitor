import db from '../database/schema';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface Service {
  id?: number;
  name: string;
  url: string;
  http_method: HttpMethod;
  request_body?: string;
  request_headers?: string;
  check_interval: number;
  timeout: number;
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

export class ServiceModel {
  static create(service: Omit<Service, 'id'>): Service {
    const stmt = db.prepare(`
      INSERT INTO services (name, url, http_method, request_body, request_headers, check_interval, timeout, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      service.name,
      service.url,
      service.http_method || 'GET',
      service.request_body || null,
      service.request_headers || null,
      service.check_interval,
      service.timeout,
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

    const values = Object.entries(updates)
      .filter(([key]) => key !== 'id')
      .map(([, value]) => value);

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
      INSERT INTO service_checks (service_id, status, response_time, status_code, error_message)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      check.service_id,
      check.status,
      check.response_time || null,
      check.status_code || null,
      check.error_message || null
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
