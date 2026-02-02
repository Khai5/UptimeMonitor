import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ServiceModel, ServiceCheckModel, IncidentModel, AppSettingsModel, DowntimeLog } from '../models/Service';
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

// Admin auth middleware: checks Bearer token against stored admin_password_hash
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);
  const storedHash = AppSettingsModel.get('admin_password_hash');

  if (!storedHash) {
    // No password set yet — first-time setup: accept any password and set it
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    AppSettingsModel.set('admin_password_hash', hash);
    next();
    return;
  }

  const providedHash = crypto.createHash('sha256').update(token).digest('hex');
  if (providedHash !== storedHash) {
    res.status(403).json({ error: 'Invalid admin password' });
    return;
  }

  next();
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

  // ========== AUTH ==========
  // Verify admin password (used by frontend login)
  router.post('/auth/login', (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      if (!password) {
        res.status(400).json({ error: 'Password is required' });
        return;
      }

      const storedHash = AppSettingsModel.get('admin_password_hash');

      if (!storedHash) {
        // First time — set the password
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        AppSettingsModel.set('admin_password_hash', hash);
        res.json({ success: true, firstTime: true });
        return;
      }

      const providedHash = crypto.createHash('sha256').update(password).digest('hex');
      if (providedHash !== storedHash) {
        res.status(403).json({ error: 'Invalid password' });
        return;
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Check if admin password has been set
  router.get('/auth/status', (req: Request, res: Response) => {
    try {
      const storedHash = AppSettingsModel.get('admin_password_hash');
      res.json({ passwordSet: !!storedHash });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check auth status' });
    }
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
      const { name, url, http_method = 'GET', request_body, request_headers, check_interval = 900, timeout = 30 } = req.body;

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

      const service = ServiceModel.create({
        name,
        url,
        http_method: method as any,
        request_body: request_body || undefined,
        request_headers: request_headers || undefined,
        check_interval,
        timeout,
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

  // Admin: Change admin password
  router.post('/admin/change-password', requireAdmin, (req: Request, res: Response) => {
    try {
      const { new_password } = req.body;
      if (!new_password || new_password.length < 8) {
        res.status(400).json({ error: 'New password must be at least 8 characters' });
        return;
      }

      const hash = crypto.createHash('sha256').update(new_password).digest('hex');
      AppSettingsModel.set('admin_password_hash', hash);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to change password' });
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

  return router;
}
