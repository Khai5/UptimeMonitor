import tls from 'tls';
import { URL } from 'url';

export interface SslCheckResult {
  valid: boolean;
  expires_at?: string;
  issuer?: string;
  days_remaining?: number;
  error?: string;
}

export class SslChecker {
  /**
   * Checks the SSL certificate of the given HTTPS URL.
   * Returns certificate validity, expiry date, issuer, and days remaining.
   */
  static async check(urlString: string, timeoutMs: number = 10000): Promise<SslCheckResult> {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(urlString);

        if (parsed.protocol !== 'https:') {
          resolve({ valid: false, error: 'URL is not HTTPS' });
          return;
        }

        const host = parsed.hostname;
        const port = parseInt(parsed.port) || 443;

        const socket = tls.connect(
          {
            host,
            port,
            servername: host,
            rejectUnauthorized: false, // We want to inspect the cert even if invalid
            timeout: timeoutMs,
          },
          () => {
            try {
              const cert = socket.getPeerCertificate();

              if (!cert || !cert.valid_to) {
                socket.destroy();
                resolve({ valid: false, error: 'No certificate found' });
                return;
              }

              const authorized = socket.authorized;
              const expiresAt = new Date(cert.valid_to).toISOString();
              const daysRemaining = Math.floor(
                (new Date(cert.valid_to).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );

              // Build issuer string
              const issuerParts: string[] = [];
              if (cert.issuer) {
                if (cert.issuer.O) issuerParts.push(cert.issuer.O);
                if (cert.issuer.CN) issuerParts.push(cert.issuer.CN);
              }
              const issuer = issuerParts.join(' - ') || 'Unknown';

              socket.destroy();

              resolve({
                valid: authorized && daysRemaining > 0,
                expires_at: expiresAt,
                issuer,
                days_remaining: daysRemaining,
                ...(authorized ? {} : { error: 'Certificate not trusted' }),
              });
            } catch (err) {
              socket.destroy();
              resolve({
                valid: false,
                error: err instanceof Error ? err.message : 'Failed to read certificate',
              });
            }
          }
        );

        socket.on('error', (err) => {
          socket.destroy();
          resolve({
            valid: false,
            error: err.message || 'TLS connection failed',
          });
        });

        socket.on('timeout', () => {
          socket.destroy();
          resolve({
            valid: false,
            error: 'SSL check timed out',
          });
        });
      } catch (err) {
        resolve({
          valid: false,
          error: err instanceof Error ? err.message : 'Failed to parse URL',
        });
      }
    });
  }
}
