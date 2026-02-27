import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { ServiceModel, ServiceCheckModel, IncidentModel, AppSettingsModel, SessionModel, AdminUserModel, DowntimeLog, OnCallContactModel, OnCallScheduleModel } from '../models/Service';
import { MonitoringService } from '../services/monitoringService';
import { NotificationService } from '../services/notificationService';

// Strip sensitive fields from a service object for public consumption
function sanitizeServiceForPublic(service: any): { id: number; name: string; status: string; last_check_at?: string } {
  return {
    id: service.id,
    name: service.name,
    status: service.status,
    last_check_at: service.last_check_at,
  };
}

// Simple in-memory rate limiter for login attempts
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function loginLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record && now < record.resetAt) {
    if (record.count >= 10) {
      res.status(429).json({ error: 'Too many login attempts. Try again in 15 minutes.' });
      return;
    }
    record.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
  }
  next();
}

// Admin auth middleware: validates session token
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  const session = SessionModel.find(token);

  if (!session || new Date(session.expires_at) < new Date()) {
    if (session) SessionModel.delete(token);
    res.status(401).json({ error: 'Session expired or invalid. Please log in again.' });
    return;
  }

  next();
}

// Returns true if hash is a legacy SHA256 hex string (pre-bcrypt)
function isLegacySha256Hash(hash: string): boolean {
  return /^[a-f0-9]{64}$/.test(hash);
}

function generateSessionToken(rememberMe = false): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const durationMs = rememberMe
    ? 14 * 24 * 60 * 60 * 1000  // 14 days
    : 24 * 60 * 60 * 1000;       // 24 hours
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  return { token, expiresAt };
}

export function createRouter(monitoringService: MonitoringService, notificationService: NotificationService): Router {
  const router = Router();

  // ========== PUBLIC ROUTES (view mode) ==========
  // These return ONLY name + status. No URLs, no secrets, no actions.

  // Public: get all services (sanitized)
  router.get('/public/services', (req: Request, res: Response) => {
    try {
      const services = ServiceModel.getAll();
      res.json(services.map(sanitizeServiceForPublic));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  // Public: overall status
  router.get('/public/status', (req: Request, res: Response) => {
    try {
      const services = ServiceModel.getAll();
      const anyDown = services.some((s) => s.status === 'down');
      const anyDegraded = services.some((s) => s.status === 'degraded');

      let overallStatus = 'operational';
      if (anyDown) {
        overallStatus = 'down';
      } else if (anyDegraded) {
        overallStatus = 'degraded';
      }

      res.json({
        status: overallStatus,
        total_services: services.length,
        operational: services.filter((s) => s.status === 'operational').length,
        degraded: services.filter((s) => s.status === 'degraded').length,
        down: services.filter((s) => s.status === 'down').length,
        unknown: services.filter((s) => s.status === 'unknown').length,
        last_updated: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch status' });
    }
  });

  // Public: status badge (embeddable HTML pill — use as iframe src)
  router.get('/public/badge', (req: Request, res: Response) => {
    try {
      const services = ServiceModel.getAll();
      const anyDown = services.some((s) => s.status === 'down');
      const anyDegraded = services.some((s) => s.status === 'degraded');
      const theme = req.query.theme === 'dark' ? 'dark' : 'light';

      let statusText: string;
      let dotColor: string;
      if (anyDown) {
        statusText = 'Outage detected';
        dotColor = '#ef4444';
      } else if (anyDegraded) {
        statusText = 'Some systems degraded';
        dotColor = '#f59e0b';
      } else {
        statusText = 'All systems operational';
        dotColor = '#22c55e';
      }

      const isDark = theme === 'dark';
      const bg = isDark ? '#1f2937' : '#ffffff';
      const border = isDark ? '#374151' : '#e5e7eb';
      const textColor = isDark ? '#f9fafb' : '#374151';

      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = req.headers['x-forwarded-host'] as string || req.headers.host || '';
      const statusPageUrl = `${proto}://${host}/`;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background: transparent;
      height: 100%;
      display: flex;
      align-items: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 4px 12px;
      border-radius: 9999px;
      border: 1px solid ${border};
      background: ${bg};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      font-weight: 500;
      color: ${textColor};
      white-space: nowrap;
      line-height: 1;
      text-decoration: none;
      cursor: pointer;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: ${dotColor};
      flex-shrink: 0;
    }
  </style>
</head>
<body>
  <a href="${statusPageUrl}" target="_blank" rel="noopener noreferrer" class="badge">
    <span class="dot"></span>
    <span>${statusText}</span>
  </a>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.send(html);
    } catch (error) {
      res.status(500).json({ error: 'Failed to generate badge' });
    }
  });

  // ========== AUTH ==========
  // Verify admin credentials (used by frontend login)
  router.post('/auth/login', loginLimiter, async (req: Request, res: Response) => {
    try {
      const { username, password, rememberMe } = req.body;
      if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
      }

      const userCount = AdminUserModel.count();

      if (userCount === 0) {
        // First time setup — create initial admin user
        if (!username) {
          res.status(400).json({ error: 'Username is required for initial setup' });
          return;
        }
        const hash = await bcrypt.hash(password, 12);
        const user = AdminUserModel.create(username, hash);
        const { token, expiresAt } = generateSessionToken(!!rememberMe);
        SessionModel.create(token, expiresAt, user.id);
        res.json({ success: true, firstTime: true, token });
        return;
      }

      if (!username) {
        res.status(400).json({ error: 'Username is required' });
        return;
      }

      const user = AdminUserModel.getByUsername(username);
      if (!user) {
        res.status(403).json({ error: 'Invalid username or password' });
        return;
      }

      // Support migrating legacy SHA256 hashes to bcrypt on first login
      let valid = false;
      if (isLegacySha256Hash(user.password_hash)) {
        const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
        valid = sha256Hash === user.password_hash;
        if (valid) {
          const newHash = await bcrypt.hash(password, 12);
          AdminUserModel.updatePassword(user.id, newHash);
        }
      } else {
        valid = await bcrypt.compare(password, user.password_hash);
      }

      if (!valid) {
        res.status(403).json({ error: 'Invalid username or password' });
        return;
      }

      const { token, expiresAt } = generateSessionToken(!!rememberMe);
      SessionModel.create(token, expiresAt, user.id);
      SessionModel.deleteExpired();
      res.json({ success: true, token });
    } catch (error) {
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Check if any admin accounts have been set up
  router.get('/auth/status', (req: Request, res: Response) => {
    try {
      const count = AdminUserModel.count();
      res.json({ passwordSet: count > 0 });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check auth status' });
    }
  });

  // Logout: invalidate the session token
  router.post('/auth/logout', (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      SessionModel.delete(authHeader.slice(7));
    }
    res.json({ success: true });
  });

  // ========== ADMIN ROUTES (require auth) ==========

  // Admin: Get all services (full details)
  router.get('/admin/services', requireAdmin, (req: Request, res: Response) => {
    try {
      const services = ServiceModel.getAll();
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  // Admin: Get service by ID (full details)
  router.get('/admin/services/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const service = ServiceModel.getById(id);

      if (!service) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      res.json(service);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch service' });
    }
  });

  // Admin: Create new service
  router.post('/admin/services', requireAdmin, (req: Request, res: Response) => {
    try {
      const { name, url, http_method = 'GET', request_body, request_headers, follow_redirects = true, keep_cookies = true, check_interval = 900, timeout = 30, alert_type = 'unavailable', alert_keyword, alert_http_statuses, verify_ssl = false, ssl_expiry_threshold = 30, verify_domain = false } = req.body;

      if (!name || !url) {
        res.status(400).json({ error: 'Name and URL are required' });
        return;
      }

      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
      const method = (http_method || 'GET').toUpperCase();
      if (!validMethods.includes(method)) {
        res.status(400).json({ error: `Invalid HTTP method. Must be one of: ${validMethods.join(', ')}` });
        return;
      }

      // Validate request_headers is valid JSON if provided
      if (request_headers) {
        try {
          JSON.parse(request_headers);
        } catch (e) {
          res.status(400).json({ error: 'request_headers must be valid JSON' });
          return;
        }
      }

      const validAlertTypes = ['unavailable', 'not_contains_keyword', 'contains_keyword', 'http_status_other_than'];
      const alertTypeValue = validAlertTypes.includes(alert_type) ? alert_type : 'unavailable';

      const service = ServiceModel.create({
        name,
        url,
        http_method: method as any,
        request_body: request_body || undefined,
        request_headers: request_headers || undefined,
        follow_redirects: follow_redirects !== false,
        keep_cookies: keep_cookies !== false,
        check_interval,
        timeout,
        alert_type: alertTypeValue,
        alert_keyword: alert_keyword || undefined,
        alert_http_statuses: alert_http_statuses || undefined,
        verify_ssl: !!verify_ssl,
        ssl_expiry_threshold: ssl_expiry_threshold || 30,
        verify_domain: !!verify_domain,
        status: 'unknown',
      });

      // Schedule monitoring for the new service
      monitoringService.scheduleService(service);

      // Perform initial check
      monitoringService.checkService(service).catch((error) => {
        console.error('Error performing initial check:', error);
      });

      res.status(201).json(service);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create service' });
    }
  });

  // Admin: Update service
  router.put('/admin/services/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;

      const service = ServiceModel.getById(id);
      if (!service) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      // Don't allow updating these fields directly
      delete updates.id;
      delete updates.status;
      delete updates.last_check_at;
      delete updates.created_at;
      delete updates.updated_at;

      // Validate request_headers is valid JSON if provided
      if (updates.request_headers) {
        try {
          JSON.parse(updates.request_headers);
        } catch (e) {
          res.status(400).json({ error: 'request_headers must be valid JSON' });
          return;
        }
      }

      ServiceModel.update(id, updates);

      // Reschedule if check_interval changed
      if (updates.check_interval) {
        const updatedService = ServiceModel.getById(id);
        if (updatedService) {
          monitoringService.scheduleService(updatedService);
        }
      }

      const updatedService = ServiceModel.getById(id);
      res.json(updatedService);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update service' });
    }
  });

  // Admin: Delete service
  router.delete('/admin/services/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      const service = ServiceModel.getById(id);
      if (!service) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      monitoringService.unscheduleService(id);
      ServiceModel.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete service' });
    }
  });

  // Admin: Manually trigger check for a service
  router.post('/admin/services/:id/check', requireAdmin, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      const service = ServiceModel.getById(id);
      if (!service) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      await monitoringService.checkService(service);
      const updatedService = ServiceModel.getById(id);
      res.json(updatedService);
    } catch (error) {
      res.status(500).json({ error: 'Failed to check service' });
    }
  });

  // Admin: Get service checks (history)
  router.get('/admin/services/:id/checks', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 100;
      const checks = ServiceCheckModel.getByServiceId(id, limit);
      res.json(checks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch service checks' });
    }
  });

  // Admin: Get service incidents
  router.get('/admin/services/:id/incidents', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;
      const incidents = IncidentModel.getByServiceId(id, limit);
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch incidents' });
    }
  });

  // Admin: Get downtime log for a service
  router.get('/admin/services/:id/downtime-log', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const service = ServiceModel.getById(id);
      if (!service) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }
      const log = IncidentModel.getDowntimeLogByServiceId(id);
      res.json(log);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch downtime log' });
    }
  });

  // Admin: Get downtime logs for all services
  router.get('/admin/downtime-logs', requireAdmin, (req: Request, res: Response) => {
    try {
      const services = ServiceModel.getAll();
      const logs: Record<number, DowntimeLog> = {};
      for (const service of services) {
        if (service.id) {
          logs[service.id] = IncidentModel.getDowntimeLogByServiceId(service.id);
        }
      }
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch downtime logs' });
    }
  });

  // Admin: Get all incidents
  router.get('/admin/incidents', requireAdmin, (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const incidents = IncidentModel.getAll(limit);
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch incidents' });
    }
  });

  // Admin: Get recent checks
  router.get('/admin/checks/recent', requireAdmin, (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const checks = ServiceCheckModel.getRecent(limit);
      res.json(checks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch recent checks' });
    }
  });

  // Admin: Get overall status (full version with active_incidents count)
  router.get('/admin/status', requireAdmin, (req: Request, res: Response) => {
    try {
      const services = ServiceModel.getAll();
      const anyDown = services.some((s) => s.status === 'down');
      const anyDegraded = services.some((s) => s.status === 'degraded');

      let overallStatus = 'operational';
      if (anyDown) {
        overallStatus = 'down';
      } else if (anyDegraded) {
        overallStatus = 'degraded';
      }

      const activeIncidents = services
        .map((s) => IncidentModel.getActiveByServiceId(s.id!))
        .filter((i) => i !== undefined);

      res.json({
        status: overallStatus,
        total_services: services.length,
        operational: services.filter((s) => s.status === 'operational').length,
        degraded: services.filter((s) => s.status === 'degraded').length,
        down: services.filter((s) => s.status === 'down').length,
        unknown: services.filter((s) => s.status === 'unknown').length,
        active_incidents: activeIncidents.length,
        last_updated: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch status' });
    }
  });

  // Admin: Get app settings (email config, etc.)
  router.get('/admin/settings', requireAdmin, (req: Request, res: Response) => {
    try {
      const settings = AppSettingsModel.getAll();
      // Never return the password hash
      delete settings['admin_password_hash'];
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  // Admin: Update app settings
  router.put('/admin/settings', requireAdmin, (req: Request, res: Response) => {
    try {
      const updates = req.body as Record<string, string>;

      // Prevent overwriting password hash through this endpoint
      delete updates['admin_password_hash'];

      for (const [key, value] of Object.entries(updates)) {
        AppSettingsModel.set(key, value);
      }

      const settings = AppSettingsModel.getAll();
      delete settings['admin_password_hash'];
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update settings' });
    }
  });

  // Admin: Change own password
  router.post('/admin/change-password', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { new_password } = req.body;
      if (!new_password || new_password.length < 8) {
        res.status(400).json({ error: 'New password must be at least 8 characters' });
        return;
      }

      const token = req.headers.authorization!.slice(7);
      const session = SessionModel.find(token);
      if (!session?.user_id) {
        res.status(400).json({ error: 'Cannot determine current user' });
        return;
      }

      const hash = await bcrypt.hash(new_password, 12);
      AdminUserModel.updatePassword(session.user_id, hash);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to change password' });
    }
  });

  // Admin: List all admin users
  router.get('/admin/admins', requireAdmin, (req: Request, res: Response) => {
    try {
      const admins = AdminUserModel.getAll();
      res.json(admins);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch admins' });
    }
  });

  // Admin: Create new admin user
  router.post('/admin/admins', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }
      if (AdminUserModel.getByUsername(username)) {
        res.status(409).json({ error: 'Username already exists' });
        return;
      }
      const hash = await bcrypt.hash(password, 12);
      const admin = AdminUserModel.create(username, hash);
      res.status(201).json({ id: admin.id, username: admin.username, created_at: admin.created_at });
    } catch (error) {
      res.status(500).json({ error: 'Failed to create admin' });
    }
  });

  // Admin: Delete admin user
  router.delete('/admin/admins/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      if (AdminUserModel.count() <= 1) {
        res.status(400).json({ error: 'Cannot delete the last admin user' });
        return;
      }

      const token = req.headers.authorization!.slice(7);
      const session = SessionModel.find(token);
      if (session?.user_id === id) {
        res.status(400).json({ error: 'Cannot delete your own account' });
        return;
      }

      const admin = AdminUserModel.getById(id);
      if (!admin) {
        res.status(404).json({ error: 'Admin not found' });
        return;
      }

      AdminUserModel.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete admin' });
    }
  });

  // Admin: Send test alert email
  router.post('/admin/test-email', requireAdmin, async (req: Request, res: Response) => {
    try {
      const configValid = await notificationService.testConnection();
      if (!configValid) {
        res.status(400).json({
          error: 'Email is not configured. Set MAILGUN or SMTP environment variables.',
        });
        return;
      }

      await notificationService.sendTestEmail();
      res.json({ success: true, message: 'Test email sent successfully' });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ========== ON-CALL CONTACTS ==========

  // List all on-call contacts
  router.get('/admin/oncall/contacts', requireAdmin, (req: Request, res: Response) => {
    try {
      res.json(OnCallContactModel.getAll());
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch on-call contacts' });
    }
  });

  // Create on-call contact
  router.post('/admin/oncall/contacts', requireAdmin, (req: Request, res: Response) => {
    try {
      const { name, email, phone } = req.body;
      if (!name || !email) {
        res.status(400).json({ error: 'Name and email are required' });
        return;
      }
      const contact = OnCallContactModel.create({ name, email, phone });
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create on-call contact' });
    }
  });

  // Update on-call contact
  router.put('/admin/oncall/contacts/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const contact = OnCallContactModel.getById(id);
      if (!contact) {
        res.status(404).json({ error: 'Contact not found' });
        return;
      }
      const { name, email, phone } = req.body;
      OnCallContactModel.update(id, { name, email, phone });
      res.json(OnCallContactModel.getById(id));
    } catch (error) {
      res.status(500).json({ error: 'Failed to update on-call contact' });
    }
  });

  // Delete on-call contact
  router.delete('/admin/oncall/contacts/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const contact = OnCallContactModel.getById(id);
      if (!contact) {
        res.status(404).json({ error: 'Contact not found' });
        return;
      }
      OnCallContactModel.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete on-call contact' });
    }
  });

  // ========== ON-CALL SCHEDULES ==========

  // Get current on-call person
  router.get('/admin/oncall/current', requireAdmin, (req: Request, res: Response) => {
    try {
      const current = OnCallScheduleModel.getCurrentOnCall();
      res.json({ current });
    } catch (error) {
      res.status(500).json({ error: 'Failed to determine current on-call' });
    }
  });

  // List all on-call schedules
  router.get('/admin/oncall/schedules', requireAdmin, (req: Request, res: Response) => {
    try {
      res.json(OnCallScheduleModel.getAll());
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch on-call schedules' });
    }
  });

  // Create on-call schedule
  router.post('/admin/oncall/schedules', requireAdmin, (req: Request, res: Response) => {
    try {
      const { contact_id, name, start_time, end_time, recurrence = 'none' } = req.body;
      if (!contact_id || !name || !start_time || !end_time) {
        res.status(400).json({ error: 'contact_id, name, start_time, and end_time are required' });
        return;
      }
      const contact = OnCallContactModel.getById(parseInt(contact_id));
      if (!contact) {
        res.status(400).json({ error: 'Contact not found' });
        return;
      }
      const validRecurrences = ['none', 'daily', 'weekly'];
      if (!validRecurrences.includes(recurrence)) {
        res.status(400).json({ error: 'recurrence must be one of: none, daily, weekly' });
        return;
      }
      if (new Date(start_time) >= new Date(end_time)) {
        res.status(400).json({ error: 'start_time must be before end_time' });
        return;
      }
      const schedule = OnCallScheduleModel.create({ contact_id: parseInt(contact_id), name, start_time, end_time, recurrence });
      res.status(201).json(OnCallScheduleModel.getById(schedule.id!));
    } catch (error) {
      res.status(500).json({ error: 'Failed to create on-call schedule' });
    }
  });

  // Update on-call schedule
  router.put('/admin/oncall/schedules/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const schedule = OnCallScheduleModel.getById(id);
      if (!schedule) {
        res.status(404).json({ error: 'Schedule not found' });
        return;
      }
      const { contact_id, name, start_time, end_time, recurrence } = req.body;
      const updates: Record<string, any> = {};
      if (contact_id !== undefined) updates.contact_id = parseInt(contact_id);
      if (name !== undefined) updates.name = name;
      if (start_time !== undefined) updates.start_time = start_time;
      if (end_time !== undefined) updates.end_time = end_time;
      if (recurrence !== undefined) updates.recurrence = recurrence;
      OnCallScheduleModel.update(id, updates);
      res.json(OnCallScheduleModel.getById(id));
    } catch (error) {
      res.status(500).json({ error: 'Failed to update on-call schedule' });
    }
  });

  // Delete on-call schedule
  router.delete('/admin/oncall/schedules/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const schedule = OnCallScheduleModel.getById(id);
      if (!schedule) {
        res.status(404).json({ error: 'Schedule not found' });
        return;
      }
      OnCallScheduleModel.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete on-call schedule' });
    }
  });

  return router;
}
