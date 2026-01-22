import { Router, Request, Response } from 'express';
import { ServiceModel, ServiceCheckModel, IncidentModel } from '../models/Service';
import { MonitoringService } from '../services/monitoringService';

export function createRouter(monitoringService: MonitoringService): Router {
  const router = Router();

  // Get all services
  router.get('/services', (req: Request, res: Response) => {
    try {
      const services = ServiceModel.getAll();
      res.json(services);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch services' });
    }
  });

  // Get service by ID
  router.get('/services/:id', (req: Request, res: Response) => {
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

  // Create new service
  router.post('/services', (req: Request, res: Response) => {
    try {
      const { name, url, check_interval = 60, timeout = 30 } = req.body;

      if (!name || !url) {
        res.status(400).json({ error: 'Name and URL are required' });
        return;
      }

      const service = ServiceModel.create({
        name,
        url,
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

  // Update service
  router.put('/services/:id', (req: Request, res: Response) => {
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

  // Delete service
  router.delete('/services/:id', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      const service = ServiceModel.getById(id);
      if (!service) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      // Unschedule monitoring
      monitoringService.unscheduleService(id);

      ServiceModel.delete(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete service' });
    }
  });

  // Get service checks (history)
  router.get('/services/:id/checks', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 100;

      const checks = ServiceCheckModel.getByServiceId(id, limit);
      res.json(checks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch service checks' });
    }
  });

  // Get service incidents
  router.get('/services/:id/incidents', (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const limit = parseInt(req.query.limit as string) || 50;

      const incidents = IncidentModel.getByServiceId(id, limit);
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch incidents' });
    }
  });

  // Get all incidents
  router.get('/incidents', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const incidents = IncidentModel.getAll(limit);
      res.json(incidents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch incidents' });
    }
  });

  // Get recent checks
  router.get('/checks/recent', (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const checks = ServiceCheckModel.getRecent(limit);
      res.json(checks);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch recent checks' });
    }
  });

  // Manually trigger check for a service
  router.post('/services/:id/check', async (req: Request, res: Response) => {
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

  // Get overall status
  router.get('/status', (req: Request, res: Response) => {
    try {
      const services = ServiceModel.getAll();
      const allOperational = services.every((s) => s.status === 'operational');
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

  return router;
}
