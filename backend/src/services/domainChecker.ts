import dns from 'dns';
import { URL } from 'url';

export interface DomainCheckResult {
  valid: boolean;
  addresses?: string[];
  error?: string;
}

export class DomainChecker {
  /**
   * Verifies that the domain in the given URL resolves via DNS.
   * Checks both A (IPv4) and AAAA (IPv6) records.
   */
  static async check(urlString: string): Promise<DomainCheckResult> {
    try {
      const parsed = new URL(urlString);
      const hostname = parsed.hostname;

      // If it's an IP address, it's valid by definition
      if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':')) {
        return { valid: true, addresses: [hostname] };
      }

      return new Promise((resolve) => {
        dns.resolve(hostname, (err, addresses) => {
          if (err) {
            // Try AAAA records if A records fail
            dns.resolve6(hostname, (err6, addresses6) => {
              if (err6) {
                resolve({
                  valid: false,
                  error: `DNS resolution failed: ${err.code || err.message}`,
                });
              } else {
                resolve({ valid: true, addresses: addresses6 });
              }
            });
          } else {
            resolve({ valid: true, addresses });
          }
        });
      });
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : 'Failed to parse URL',
      };
    }
  }
}
