import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './database/schema';
import { createRouter } from './api/routes';
import { NotificationService } from './services/notificationService';
import { MonitoringService } from './services/monitoringService';

// Load environment variables
dotenv.config();

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
initializeDatabase();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize notification service
const emailConfig = process.env.SMTP_HOST
  ? {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
      from: process.env.EMAIL_FROM || '',
      to: (process.env.EMAIL_TO || '').split(',').filter(Boolean),
    }
  : undefined;

const notificationService = new NotificationService(emailConfig);

// Initialize monitoring service
const monitoringService = new MonitoringService(notificationService);

// Setup routes
app.use('/api', createRouter(monitoringService));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);

  // Start monitoring
  monitoringService.startMonitoring();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  monitoringService.stopMonitoring();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  monitoringService.stopMonitoring();
  process.exit(0);
});
