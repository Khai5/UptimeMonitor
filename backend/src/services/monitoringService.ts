import cron from 'node-cron';
import { ServiceModel, ServiceCheckModel, IncidentModel, Service } from '../models/Service';
import { HealthChecker } from './healthChecker';
import { NotificationService } from './notificationService';

export class MonitoringService {
  private notificationService: NotificationService;
  private cronJobs: Map<number, cron.ScheduledTask> = new Map();

  constructor(notificationService: NotificationService) {
    this.notificationService = notificationService;
  }

  async checkService(service: Service): Promise<void> {
    if (!service.id) return;

    console.log(`Checking service: ${service.name} (${service.url})`);

    // Perform health check
    const result = await HealthChecker.checkService(service);

    // Record the check (including SSL/domain data)
    ServiceCheckModel.create({
      service_id: service.id,
      status: result.status,
      response_time: result.response_time,
      status_code: result.status_code,
      error_message: result.error_message,
      ssl_valid: result.ssl_valid,
      ssl_expires_at: result.ssl_expires_at,
      ssl_issuer: result.ssl_issuer,
      ssl_days_remaining: result.ssl_days_remaining,
      domain_valid: result.domain_valid,
      domain_error: result.domain_error,
    });

    // Get current service status
    const currentService = ServiceModel.getById(service.id);
    const previousStatus = currentService?.status || 'unknown';

    // Update service status
    ServiceModel.updateStatus(service.id, result.status);

    // Handle status changes
    await this.handleStatusChange(service.id, previousStatus, result.status, result.error_message);
  }

  private async handleStatusChange(
    serviceId: number,
    previousStatus: string,
    newStatus: string,
    errorMessage?: string
  ): Promise<void> {
    const service = ServiceModel.getById(serviceId);
    if (!service) return;

    // Service went down
    if (previousStatus !== 'down' && newStatus === 'down') {
      console.log(`🚨 Service DOWN: ${service.name}`);

      // Create incident
      const incident = IncidentModel.create({
        service_id: serviceId,
        started_at: new Date().toISOString(),
        error_message: errorMessage,
        notification_sent: false,
      });

      // Send notification
      try {
        await this.notificationService.sendServiceDownAlert(service, incident);
        IncidentModel.markNotificationSent(incident.id!);
      } catch (error) {
        console.error('Failed to send down notification:', error);
      }
    }

    // Service recovered
    if (previousStatus === 'down' && newStatus !== 'down') {
      console.log(`✅ Service RECOVERED: ${service.name}`);

      // Find and resolve active incident
      const activeIncident = IncidentModel.getActiveByServiceId(serviceId);
      if (activeIncident && activeIncident.id) {
        IncidentModel.resolve(activeIncident.id);

        // Send recovery notification
        try {
          const resolvedIncident = IncidentModel.getByServiceId(serviceId, 1)[0];
          await this.notificationService.sendServiceRecoveredAlert(service, resolvedIncident);
        } catch (error) {
          console.error('Failed to send recovery notification:', error);
        }
      }
    }

    // Log degraded performance
    if (newStatus === 'degraded') {
      console.log(`⚠️ Service DEGRADED: ${service.name}`);
    }
  }

  scheduleService(service: Service): void {
    if (!service.id) return;

    // Remove existing job if any
    this.unscheduleService(service.id);

    // Convert check_interval (seconds) to cron expression
    const intervalSeconds = service.check_interval;
    let cronExpression: string;

    if (intervalSeconds < 60) {
      // Every N seconds (using */N syntax for seconds isn't standard cron, so we'll use minimum 1 minute)
      cronExpression = '* * * * *'; // Every minute
    } else if (intervalSeconds === 60) {
      cronExpression = '* * * * *'; // Every minute
    } else if (intervalSeconds % 60 === 0) {
      const minutes = intervalSeconds / 60;
      if (minutes < 60) {
        cronExpression = `*/${minutes} * * * *`; // Every N minutes
      } else {
        cronExpression = '* * * * *'; // Default to every minute
      }
    } else {
      cronExpression = '* * * * *'; // Default to every minute
    }

    // Create cron job
    const job = cron.schedule(cronExpression, async () => {
      await this.checkService(service);
    });

    this.cronJobs.set(service.id, job);
    console.log(`Scheduled monitoring for ${service.name} (every ${service.check_interval}s)`);
  }

  unscheduleService(serviceId: number): void {
    const job = this.cronJobs.get(serviceId);
    if (job) {
      job.stop();
      this.cronJobs.delete(serviceId);
      console.log(`Unscheduled monitoring for service ID: ${serviceId}`);
    }
  }

  startMonitoring(): void {
    console.log('Starting monitoring service...');

    // Get all services and schedule them
    const services = ServiceModel.getAll();

    for (const service of services) {
      this.scheduleService(service);

      // Perform initial check immediately
      if (service.id) {
        this.checkService(service).catch((error) => {
          console.error(`Error checking service ${service.name}:`, error);
        });
      }
    }

    console.log(`Monitoring started for ${services.length} service(s)`);
  }

  stopMonitoring(): void {
    console.log('Stopping monitoring service...');

    for (const [serviceId, job] of this.cronJobs) {
      job.stop();
    }

    this.cronJobs.clear();
    console.log('Monitoring stopped');
  }

  async checkAllServicesNow(): Promise<void> {
    const services = ServiceModel.getAll();

    for (const service of services) {
      await this.checkService(service);
    }
  }
}
