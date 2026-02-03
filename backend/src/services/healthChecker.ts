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

      // Build request config
      const requestConfig: AxiosRequestConfig = {
        method: method as AxiosRequestConfig['method'],
        url: service.url,
        timeout: service.timeout * 1000,
        validateStatus: (status: number) => status < 500,
        headers,
        maxRedirects: followRedirects ? 5 : 0,
        // Enable credentials for cookie handling
        withCredentials: keepCookies,
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

      // Determine status based on response
      let status: HealthCheckResult['status'];

      if (response.status >= 200 && response.status < 300) {
        status = 'operational';
      } else if (response.status >= 300 && response.status < 500) {
        status = 'operational'; // Redirects and client errors are still considered operational
      } else {
        status = 'down';
      }

      // Check if response time is too slow (degraded performance)
      if (status === 'operational' && responseTime > service.timeout * 1000 * 0.8) {
        status = 'degraded';
      }

      return {
        status,
        response_time: responseTime,
        status_code: response.status,
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
