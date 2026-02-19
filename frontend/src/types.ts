export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type AlertType = 'unavailable' | 'not_contains_keyword' | 'contains_keyword' | 'http_status_other_than';

export interface Service {
  id: number;
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

// Public view: only name + status (no URLs, no secrets)
export interface PublicService {
  id: number;
  name: string;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  last_check_at?: string;
}

export interface ServiceCheck {
  id: number;
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
  checked_at: string;
}

export interface Incident {
  id: number;
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

export type OnCallRecurrence = 'none' | 'daily' | 'weekly';

export interface OnCallContact {
  id: number;
  name: string;
  email: string;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OnCallSchedule {
  id: number;
  contact_id: number;
  name: string;
  start_time: string;
  end_time: string;
  recurrence: OnCallRecurrence;
  contact_name: string;
  contact_email: string;
  contact_phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OverallStatus {
  status: 'operational' | 'degraded' | 'down';
  total_services: number;
  operational: number;
  degraded: number;
  down: number;
  unknown: number;
  active_incidents?: number;
  last_updated: string;
}
