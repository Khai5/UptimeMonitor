export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export interface Service {
  id: number;
  name: string;
  url: string;
  http_method: HttpMethod;
  check_interval: number;
  timeout: number;
  status: 'operational' | 'degraded' | 'down' | 'unknown';
  last_check_at?: string;
  last_status_change_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ServiceCheck {
  id: number;
  service_id: number;
  status: 'operational' | 'degraded' | 'down';
  response_time?: number;
  status_code?: number;
  error_message?: string;
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

export interface OverallStatus {
  status: 'operational' | 'degraded' | 'down';
  total_services: number;
  operational: number;
  degraded: number;
  down: number;
  unknown: number;
  active_incidents: number;
  last_updated: string;
}
