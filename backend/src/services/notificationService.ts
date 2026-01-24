import nodemailer from 'nodemailer';
import { Service, Incident } from '../models/Service';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  to: string[];
}

export class NotificationService {
  private emailConfig?: EmailConfig;
  private transporter?: nodemailer.Transporter;

  constructor(emailConfig?: EmailConfig) {
    this.emailConfig = emailConfig;

    if (emailConfig) {
      this.transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: {
          user: emailConfig.user,
          pass: emailConfig.password,
        },
      });
    }
  }

  async sendServiceDownAlert(service: Service, incident: Incident): Promise<void> {
    if (!this.emailConfig || !this.transporter) {
      console.log('Email not configured, skipping notification');
      return;
    }

    const subject = `🚨 Service Down Alert: ${service.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Service Down</h1>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937; margin-top: 0;">${service.name}</h2>
          <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>URL:</strong> <code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${service.url}</code></p>
            <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">DOWN</span></p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date(incident.started_at).toLocaleString()}</p>
            ${incident.error_message ? `<p style="margin: 5px 0;"><strong>Error:</strong> ${incident.error_message}</p>` : ''}
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            This is an automated alert from your Uptime Monitor. The service will be continuously monitored and you'll be notified when it's back online.
          </p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.emailConfig.from,
        to: this.emailConfig.to.join(', '),
        subject,
        html,
      });

      console.log(`Alert email sent for service: ${service.name}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw error;
    }
  }

  async sendServiceRecoveredAlert(service: Service, incident: Incident): Promise<void> {
    if (!this.emailConfig || !this.transporter) {
      console.log('Email not configured, skipping notification');
      return;
    }

    const durationMinutes = incident.duration ? Math.floor(incident.duration / 60) : 0;
    const durationSeconds = incident.duration ? incident.duration % 60 : 0;

    const subject = `✅ Service Recovered: ${service.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">✅ Service Recovered</h1>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <h2 style="color: #1f2937; margin-top: 0;">${service.name}</h2>
          <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
            <p style="margin: 5px 0;"><strong>URL:</strong> <code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${service.url}</code></p>
            <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">OPERATIONAL</span></p>
            <p style="margin: 5px 0;"><strong>Recovered at:</strong> ${incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Downtime:</strong> ${durationMinutes}m ${durationSeconds}s</p>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            The service is now back online and operational. Continuous monitoring will continue.
          </p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.emailConfig.from,
        to: this.emailConfig.to.join(', '),
        subject,
        html,
      });

      console.log(`Recovery email sent for service: ${service.name}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('Email configuration is valid');
      return true;
    } catch (error) {
      console.error('Email configuration is invalid:', error);
      return false;
    }
  }
}
