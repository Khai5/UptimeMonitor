import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { Service } from '../models/Service';
import { SslChecker, SslCheckResult } from './sslChecker';
import { DomainChecker, DomainCheckResult } from './domainChecker';

export interface HealthCheckResult {
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

      const httpResult: HealthCheckResult = {
        status,
        response_time: responseTime,
        status_code: response.status,
        ...(errorMessage ? { error_message: errorMessage } : {}),
      };

      return this.performSslDomainChecks(service, httpResult);
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorResult: HealthCheckResult;

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        if (axiosError.code === 'ECONNABORTED') {
          errorResult = {
            status: 'down',
            response_time: responseTime,
            error_message: 'Request timeout',
          };
        } else if (axiosError.response) {
          // For http_status_other_than, a 5xx response might still be an "expected" status
          if (alertType === 'http_status_other_than') {
            const expectedStatuses = (service.alert_http_statuses || '200')
              .split(',')
              .map(s => parseInt(s.trim(), 10))
              .filter(n => !isNaN(n));
            if (expectedStatuses.includes(axiosError.response.status)) {
              errorResult = {
                status: 'operational',
                response_time: responseTime,
                status_code: axiosError.response.status,
              };
              return this.performSslDomainChecks(service, errorResult);
            }
          }

          // Server responded with error status
          errorResult = {
            status: 'down',
            response_time: responseTime,
            status_code: axiosError.response.status,
            error_message: `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`,
          };
        } else if (axiosError.request) {
          // Request was made but no response received
          errorResult = {
            status: 'down',
            response_time: responseTime,
            error_message: axiosError.message || 'No response received',
          };
        } else {
          errorResult = {
            status: 'down',
            response_time: responseTime,
            error_message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      } else {
        // Other errors
        errorResult = {
          status: 'down',
          response_time: responseTime,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        };
      }

      return this.performSslDomainChecks(service, errorResult);
    }
  }

  /**
   * Perform SSL and domain verification checks if enabled on the service.
   * Enriches the result object with SSL/domain data and may change status to 'down'.
   */
  private static async performSslDomainChecks(
    service: Service,
    result: HealthCheckResult
  ): Promise<HealthCheckResult> {
    const verifySsl = service.verify_ssl === true || (service.verify_ssl as unknown) === 1;
    const verifyDomain = service.verify_domain === true || (service.verify_domain as unknown) === 1;

    // Domain verification
    if (verifyDomain) {
      try {
        const domainResult: DomainCheckResult = await DomainChecker.check(service.url);
        result.domain_valid = domainResult.valid;
        if (!domainResult.valid) {
          result.domain_error = domainResult.error;
          result.status = 'down';
          result.error_message = result.error_message
            ? `${result.error_message}; Domain verification failed: ${domainResult.error}`
            : `Domain verification failed: ${domainResult.error}`;
        }
      } catch (err) {
        result.domain_valid = false;
        result.domain_error = err instanceof Error ? err.message : 'Domain check failed';
      }
    }

    // SSL verification
    if (verifySsl && service.url.startsWith('https://')) {
      try {
        const sslResult: SslCheckResult = await SslChecker.check(service.url, service.timeout * 1000);
        result.ssl_valid = sslResult.valid;
        result.ssl_expires_at = sslResult.expires_at;
        result.ssl_issuer = sslResult.issuer;
        result.ssl_days_remaining = sslResult.days_remaining;

        if (!sslResult.valid) {
          result.status = 'down';
          const sslError = sslResult.error || 'SSL certificate invalid';
          result.error_message = result.error_message
            ? `${result.error_message}; SSL: ${sslError}`
            : `SSL: ${sslError}`;
        } else if (sslResult.days_remaining != null) {
          const threshold = service.ssl_expiry_threshold || 30;
          if (sslResult.days_remaining <= threshold) {
            // Certificate expiring soon - mark as degraded if currently operational
            if (result.status === 'operational') {
              result.status = 'degraded';
            }
            result.error_message = result.error_message
              ? `${result.error_message}; SSL certificate expires in ${sslResult.days_remaining} days`
              : `SSL certificate expires in ${sslResult.days_remaining} days`;
          }
        }
      } catch (err) {
        result.ssl_valid = false;
        const errMsg = err instanceof Error ? err.message : 'SSL check failed';
        result.error_message = result.error_message
          ? `${result.error_message}; SSL: ${errMsg}`
          : `SSL: ${errMsg}`;
      }
    }

    return result;
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
