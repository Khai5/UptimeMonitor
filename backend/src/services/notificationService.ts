import nodemailer from 'nodemailer';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { Service, Incident } from '../models/Service';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  /** Set to true to use Mailgun's EU region endpoint */
  eu?: boolean;
}

export interface NotificationConfig {
  from: string;
  to: string[];
  /** Use one of smtp or mailgun. If both are provided, mailgun takes precedence. */
  smtp?: SmtpConfig;
  mailgun?: MailgunConfig;
}

export class NotificationService {
  private config?: NotificationConfig;
  private transporter?: nodemailer.Transporter;
  private mailgunClient?: ReturnType<InstanceType<typeof Mailgun>['client']>;

  constructor(config?: NotificationConfig) {
    this.config = config;

    if (!config) return;

    if (config.mailgun) {
      const mg = new Mailgun(FormData);
      this.mailgunClient = mg.client({
        username: 'api',
        key: config.mailgun.apiKey,
        ...(config.mailgun.eu ? { url: 'https://api.eu.mailgun.net' } : {}),
      });
    } else if (config.smtp) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.secure,
        auth: {
          user: config.smtp.user,
          pass: config.smtp.password,
        },
      });
    }
  }

  private get isConfigured(): boolean {
    return !!(this.transporter || this.mailgunClient);
  }

  private async sendEmail(subject: string, html: string): Promise<void> {
    if (!this.config) throw new Error('Notification config not set');

    if (this.mailgunClient && this.config.mailgun) {
      await this.mailgunClient.messages.create(this.config.mailgun.domain, {
        from: this.config.from,
        to: this.config.to,
        subject,
        html,
      });
    } else if (this.transporter) {
      await this.transporter.sendMail({
        from: this.config.from,
        to: this.config.to.join(', '),
        subject,
        html,
      });
    }
  }

  async sendServiceDownAlert(service: Service, incident: Incident): Promise<void> {
    if (!this.isConfigured) {
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
      await this.sendEmail(subject, html);
      console.log(`Alert email sent for service: ${service.name}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw error;
    }
  }

  async sendServiceRecoveredAlert(service: Service, incident: Incident): Promise<void> {
    if (!this.isConfigured) {
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
      await this.sendEmail(subject, html);
      console.log(`Recovery email sent for service: ${service.name}`);
    } catch (error) {
      console.error('Failed to send email notification:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    if (this.mailgunClient && this.config?.mailgun) {
      try {
        await this.mailgunClient.domains.get(this.config.mailgun.domain);
        console.log('Mailgun configuration is valid');
        return true;
      } catch (error) {
        console.error('Mailgun configuration is invalid:', error);
        return false;
      }
    }

    if (this.transporter) {
      try {
        await this.transporter.verify();
        console.log('Email configuration is valid');
        return true;
      } catch (error) {
        console.error('Email configuration is invalid:', error);
        return false;
      }
    }

    return false;
  }
}
