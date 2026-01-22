import axios, { AxiosError } from 'axios';
import { Service, ServiceCheck } from '../models/Service';

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
      const response = await axios.get(service.url, {
        timeout: service.timeout * 1000,
        validateStatus: (status) => status < 500, // Consider 4xx as operational
        headers: {
          'User-Agent': 'UptimeMonitor/1.0',
        },
      });

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
