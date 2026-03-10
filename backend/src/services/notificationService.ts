import nodemailer from 'nodemailer';
import Mailgun from 'mailgun.js';
import FormData from 'form-data';
import { Service, Incident, AppSettingsModel, OnCallScheduleWithContact } from '../models/Service';

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
  /** Base URL of the admin dashboard, e.g. https://example.com/admin */
  appUrl?: string;
}

/** Strip HTML tags and collapse whitespace to produce a plain-text fallback. */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|h[1-6]|li)[^>]*>/gi, '\n')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export class NotificationService {
  private config?: NotificationConfig;
  private transporter?: nodemailer.Transporter;
  private mailgunClient?: ReturnType<InstanceType<typeof Mailgun>['client']>;
  private adminUrl: string;

  constructor(config?: NotificationConfig) {
    this.config = config;
    this.adminUrl = config?.appUrl || '';

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

  private adminButton(color: string): string {
    if (!this.adminUrl) return '';
    return `<div style="text-align: center; margin-top: 20px;"><a href="${this.adminUrl}" style="display: inline-block; background-color: ${color}; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Admin Dashboard</a></div>`;
  }

  private getRecipients(): string[] {
    // Read from database setting first (editable via admin UI), fall back to env var config
    const dbEmails = AppSettingsModel.get('alert_emails');
    if (dbEmails) {
      return dbEmails.split(',').map((e) => e.trim()).filter(Boolean);
    }
    return this.config?.to || [];
  }

  /** Extract a bare email address from a "Display Name <email>" string. */
  private extractEmail(from: string): string {
    const match = from.match(/<([^>]+)>/);
    return match ? match[1] : from;
  }

  private async sendEmail(subject: string, html: string): Promise<void> {
    if (!this.config) throw new Error('Notification config not set');

    const recipients = this.getRecipients();
    if (recipients.length === 0) {
      console.warn('No email recipients configured. Set them in admin settings or EMAIL_TO env var.');
      return;
    }

    const text = htmlToText(html);
    const replyTo = this.extractEmail(this.config.from);

    const errors: { recipient: string; error: unknown }[] = [];

    // Send individually to each recipient so one failure doesn't block others
    for (const recipient of recipients) {
      try {
        if (this.mailgunClient && this.config.mailgun) {
          await this.mailgunClient.messages.create(this.config.mailgun.domain, {
            from: this.config.from,
            to: [recipient],
            subject,
            html,
            text,
            'h:Reply-To': replyTo,
            'h:List-Unsubscribe': `<mailto:${replyTo}?subject=unsubscribe>`,
            'h:List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            'h:Precedence': 'transactional',
            'h:Auto-Submitted': 'auto-generated',
          });
        } else if (this.transporter) {
          await this.transporter.sendMail({
            from: this.config.from,
            to: recipient,
            replyTo,
            subject,
            html,
            text,
            headers: {
              'List-Unsubscribe': `<mailto:${replyTo}?subject=unsubscribe>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              'Precedence': 'transactional',
              'Auto-Submitted': 'auto-generated',
            },
          });
        }
        console.log(`Email sent successfully to ${recipient}`);
      } catch (error) {
        console.error(`Failed to send email to ${recipient}:`, error);
        if (this.mailgunClient && this.config.mailgun) {
          const domain = this.config.mailgun.domain;
          if (domain.includes('mailgun.org')) {
            console.error(
              `Hint: You are using a Mailgun sandbox domain (${domain}). ` +
              `Sandbox domains can only send to authorized recipients. ` +
              `Add ${recipient} as an authorized recipient in your Mailgun dashboard, ` +
              `or use a custom verified domain.`
            );
          }
        }
        errors.push({ recipient, error });
      }
    }

    if (errors.length === recipients.length) {
      // All sends failed
      throw new Error(
        `Failed to send email to all recipients: ${errors.map((e) => e.recipient).join(', ')}`
      );
    } else if (errors.length > 0) {
      console.warn(
        `Email sent to ${recipients.length - errors.length}/${recipients.length} recipients. ` +
        `Failed: ${errors.map((e) => e.recipient).join(', ')}`
      );
    }
  }

  private async sendEmailToAddress(recipient: string, subject: string, html: string): Promise<void> {
    if (!this.config) throw new Error('Notification config not set');

    const text = htmlToText(html);
    const replyTo = this.extractEmail(this.config.from);

    if (this.mailgunClient && this.config.mailgun) {
      await this.mailgunClient.messages.create(this.config.mailgun.domain, {
        from: this.config.from,
        to: [recipient],
        subject,
        html,
        text,
        'h:Reply-To': replyTo,
        'h:List-Unsubscribe': `<mailto:${replyTo}?subject=unsubscribe>`,
        'h:List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'h:Precedence': 'transactional',
        'h:Auto-Submitted': 'auto-generated',
      });
    } else if (this.transporter) {
      await this.transporter.sendMail({
        from: this.config.from,
        to: recipient,
        replyTo,
        subject,
        html,
        text,
        headers: {
          'List-Unsubscribe': `<mailto:${replyTo}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          'Precedence': 'transactional',
          'Auto-Submitted': 'auto-generated',
        },
      });
    }
  }

  async sendServiceDownAlert(service: Service, incident: Incident, onCallContact?: OnCallScheduleWithContact): Promise<void> {
    if (!this.isConfigured) {
      console.log('Email not configured, skipping notification');
      return;
    }

    // Determine if this is an SSL/domain specific issue for better subject lines
    const errorMsg = incident.error_message || '';
    const isSslIssue = errorMsg.includes('SSL');
    const isDomainIssue = errorMsg.includes('Domain verification failed');

    let alertTitle = 'Service Down';
    if (isSslIssue && !isDomainIssue) alertTitle = 'SSL Certificate Issue';
    else if (isDomainIssue && !isSslIssue) alertTitle = 'Domain Verification Failed';
    else if (isSslIssue && isDomainIssue) alertTitle = 'SSL & Domain Issues';

    const subject = `${alertTitle}: ${service.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">${alertTitle}</h1>
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
          ${this.adminButton('#dc2626')}
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

    // Notify on-call contact if not already in the standard recipients list
    if (onCallContact && this.isConfigured) {
      const recipients = this.getRecipients();
      if (!recipients.includes(onCallContact.contact_email)) {
        const onCallSubject = `On-Call Alert - ${alertTitle}: ${service.name}`;
        const onCallHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #7c3aed; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">On-Call Alert</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">You are currently on-call (${onCallContact.name} – ${onCallContact.name})</p>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <h2 style="color: #1f2937; margin-top: 0;">${service.name}</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>URL:</strong> <code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${service.url}</code></p>
                <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #dc2626; font-weight: bold;">DOWN</span></p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date(incident.started_at).toLocaleString()}</p>
                ${incident.error_message ? `<p style="margin: 5px 0;"><strong>Error:</strong> ${incident.error_message}</p>` : ''}
              </div>
              <div style="background-color: #ede9fe; border-left: 4px solid #7c3aed; padding: 12px; border-radius: 4px; margin-top: 15px;">
                <p style="margin: 0; color: #5b21b6; font-weight: bold;">You are the on-call engineer. Please investigate and resolve this incident.</p>
                <p style="margin: 6px 0 0; color: #6d28d9; font-size: 14px;">On-call schedule: ${onCallContact.name}</p>
              </div>
              ${this.adminButton('#7c3aed')}
            </div>
          </div>
        `;
        try {
          await this.sendEmailToAddress(onCallContact.contact_email, onCallSubject, onCallHtml);
          console.log(`On-call alert sent to ${onCallContact.contact_name} <${onCallContact.contact_email}>`);
        } catch (err) {
          console.error(`Failed to send on-call alert to ${onCallContact.contact_email}:`, err);
        }
      }
    }
  }

  async sendServiceRecoveredAlert(service: Service, incident: Incident, onCallContact?: OnCallScheduleWithContact): Promise<void> {
    if (!this.isConfigured) {
      console.log('Email not configured, skipping notification');
      return;
    }

    const durationMinutes = incident.duration ? Math.floor(incident.duration / 60) : 0;
    const durationSeconds = incident.duration ? incident.duration % 60 : 0;

    const subject = `Service Recovered: ${service.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Service Recovered</h1>
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
          ${this.adminButton('#059669')}
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

    // Notify on-call contact if not already in the standard recipients list
    if (onCallContact && this.isConfigured) {
      const recipients = this.getRecipients();
      if (!recipients.includes(onCallContact.contact_email)) {
        const onCallSubject = `On-Call Alert - Service Recovered: ${service.name}`;
        const onCallHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #059669; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; font-size: 24px;">On-Call – Service Recovered</h1>
              <p style="margin: 8px 0 0; opacity: 0.9;">You are currently on-call (${onCallContact.name})</p>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <h2 style="color: #1f2937; margin-top: 0;">${service.name}</h2>
              <div style="background-color: white; padding: 15px; border-radius: 6px; margin: 15px 0;">
                <p style="margin: 5px 0;"><strong>URL:</strong> <code style="background-color: #f3f4f6; padding: 2px 6px; border-radius: 3px;">${service.url}</code></p>
                <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: #059669; font-weight: bold;">OPERATIONAL</span></p>
                <p style="margin: 5px 0;"><strong>Recovered at:</strong> ${incident.resolved_at ? new Date(incident.resolved_at).toLocaleString() : 'N/A'}</p>
                <p style="margin: 5px 0;"><strong>Downtime:</strong> ${durationMinutes}m ${durationSeconds}s</p>
              </div>
              ${this.adminButton('#059669')}
            </div>
          </div>
        `;
        try {
          await this.sendEmailToAddress(onCallContact.contact_email, onCallSubject, onCallHtml);
          console.log(`On-call recovery alert sent to ${onCallContact.contact_name} <${onCallContact.contact_email}>`);
        } catch (err) {
          console.error(`Failed to send on-call recovery alert to ${onCallContact.contact_email}:`, err);
        }
      }
    }
  }

  async sendTestEmail(requestBaseUrl?: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Email not configured');
    }

    const effectiveAdminUrl = this.adminUrl || requestBaseUrl || '';
    const button = effectiveAdminUrl
      ? `<div style="text-align: center; margin-top: 20px;"><a href="${effectiveAdminUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View Admin Dashboard</a></div>`
      : '';

    const subject = 'Uptime Monitor - Test Alert Email';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Test Alert Email</h1>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <p style="color: #1f2937;">This is a test email from your Uptime Monitor.</p>
          <p style="color: #1f2937;">If you received this, your email notification configuration is working correctly.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
            Sent at: ${new Date().toLocaleString()}
          </p>
          ${button}
        </div>
      </div>
    `;

    await this.sendEmail(subject, html);
    console.log('Test email sent successfully');
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
