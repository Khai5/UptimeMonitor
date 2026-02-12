import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { Service } from '../models/Service';

export interface HealthCheckResult {
  status: 'operational' | 'degraded' | 'down';
  response_time?: number;
  status_code?: number;
  error_message?: string;
}

export class HealthChecker {
  static async checkService(service: Service): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const alertType = service.alert_type || 'unavailable';

    try {
      const method = (service.http_method || 'GET').toLowerCase() as string;

      // Build headers: start with default, merge in custom headers
      const headers: Record<string, string> = {
        'User-Agent': 'UptimeMonitor/1.0',
      };

      if (service.request_headers) {
        try {
          const customHeaders = JSON.parse(service.request_headers);
          Object.assign(headers, customHeaders);
        } catch (e) {
          console.warn(`Invalid request_headers JSON for service ${service.name}:`, e);
        }
      }

      // Determine redirect behavior (default to following redirects)
      // SQLite stores booleans as 0/1, so we check for both false and 0
      const followRedirects = service.follow_redirects !== false && (service.follow_redirects as unknown) !== 0;
      const keepCookies = service.keep_cookies !== false && (service.keep_cookies as unknown) !== 0;

      // Need response body for keyword-based alert types
      const needsBody = alertType === 'contains_keyword' || alertType === 'not_contains_keyword';

      // Build request config
      const requestConfig: AxiosRequestConfig = {
        method: method as AxiosRequestConfig['method'],
        url: service.url,
        timeout: service.timeout * 1000,
        validateStatus: alertType === 'http_status_other_than' ? () => true : (status: number) => status < 500,
        headers,
        maxRedirects: followRedirects ? 5 : 0,
        // Enable credentials for cookie handling
        withCredentials: keepCookies,
        // Ensure we get text response for keyword checks
        ...(needsBody ? { responseType: 'text', transformResponse: [(data: string) => data] } : {}),
      };

      // Add request body for methods that support it
      if (service.request_body && ['post', 'put', 'patch'].includes(method)) {
        // Replace {timestamp} placeholder with current timestamp
        let bodyContent = service.request_body.replace(
          /\{timestamp\}/g,
          String(Date.now())
        );

        try {
          requestConfig.data = JSON.parse(bodyContent);
          // Set content-type if not already set by custom headers
          if (!headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
          }
        } catch (e) {
          // If not valid JSON, send as raw string
          requestConfig.data = bodyContent;
        }
      }

      const response = await axios.request(requestConfig);

      const responseTime = Date.now() - startTime;

      // Determine status based on alert type
      let status: HealthCheckResult['status'];
      let errorMessage: string | undefined;

      if (alertType === 'contains_keyword') {
        // Alert when the response CONTAINS the keyword (treat as down)
        const keyword = service.alert_keyword || '';
        const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        if (keyword && body.includes(keyword)) {
          status = 'down';
          errorMessage = `Response contains keyword "${keyword}"`;
        } else {
          status = 'operational';
        }
      } else if (alertType === 'not_contains_keyword') {
        // Alert when the response does NOT contain the keyword (treat as down)
        const keyword = service.alert_keyword || '';
        const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        if (keyword && !body.includes(keyword)) {
          status = 'down';
          errorMessage = `Response does not contain keyword "${keyword}"`;
        } else {
          status = 'operational';
        }
      } else if (alertType === 'http_status_other_than') {
        // Alert when status code is NOT in the expected list
        const expectedStatuses = (service.alert_http_statuses || '200')
          .split(',')
          .map(s => parseInt(s.trim(), 10))
          .filter(n => !isNaN(n));
        if (!expectedStatuses.includes(response.status)) {
          status = 'down';
          errorMessage = `HTTP ${response.status} (expected ${expectedStatuses.join(', ')})`;
        } else {
          status = 'operational';
        }
      } else {
        // Default: 'unavailable' - original behavior
        if (response.status >= 200 && response.status < 500) {
          status = 'operational';
        } else {
          status = 'down';
        }
      }

      // Check if response time is too slow (degraded performance)
      if (status === 'operational' && responseTime > service.timeout * 1000 * 0.8) {
        status = 'degraded';
      }

      return {
        status,
        response_time: responseTime,
        status_code: response.status,
        ...(errorMessage ? { error_message: errorMessage } : {}),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.code === 'ECONNABORTED') {
          return {
            status: 'down',
            response_time: responseTime,
            error_message: 'Request timeout',
          };
        }

        if (axiosError.response) {
          // For http_status_other_than, a 5xx response might still be an "expected" status
          if (alertType === 'http_status_other_than') {
            const expectedStatuses = (service.alert_http_statuses || '200')
              .split(',')
              .map(s => parseInt(s.trim(), 10))
              .filter(n => !isNaN(n));
            if (expectedStatuses.includes(axiosError.response.status)) {
              return {
                status: 'operational',
                response_time: responseTime,
                status_code: axiosError.response.status,
              };
            }
          }

          // Server responded with error status
          return {
            status: 'down',
            response_time: responseTime,
            status_code: axiosError.response.status,
            error_message: `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
          };
        }

        if (axiosError.request) {
          // Request was made but no response received
          return {
            status: 'down',
            response_time: responseTime,
            error_message: axiosError.message || 'No response received',
          };
        }
      }

      // Other errors
      return {
        status: 'down',
        response_time: responseTime,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  static async checkMultipleServices(services: Service[]): Promise<Map<number, HealthCheckResult>> {
    const results = new Map<number, HealthCheckResult>();

    // Check all services in parallel
    const checks = services.map(async (service) => {
      if (!service.id) return;

      const result = await this.checkService(service);
      results.set(service.id, result);
    });

    await Promise.all(checks);

    return results;
  }
}
