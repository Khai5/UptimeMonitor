# Uptime Monitor

A comprehensive uptime monitoring system similar to BetterStack that monitors service availability and sends email notifications when services go down.

## Features

- **Real-time Service Monitoring**: Monitor multiple HTTP/HTTPS endpoints with customizable check intervals
- **Health Checks**: Automatic periodic health checks with configurable timeouts
- **Status Dashboard**: Beautiful React-based dashboard showing service status in real-time
- **Email Notifications**: Receive instant email alerts when services go down or recover
- **Incident Tracking**: Track and record all incidents with detailed history
- **Response Time Monitoring**: Monitor and record response times for each service
- **SQLite Database**: Lightweight database for storing service data and history

## Screenshots

The dashboard displays all your monitored services with their current status (Operational, Degraded, or Down) similar to the BetterStack interface.

## Architecture

- **Backend**: Node.js + TypeScript + Express
- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Database**: SQLite (better-sqlite3)
- **Monitoring**: Cron-based scheduler with axios for HTTP checks
- **Notifications**: Nodemailer for SMTP email notifications

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd UptimeMonitor
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 4. Configure environment variables

Copy the example environment file and configure your settings:

```bash
cd ../backend
cp .env.example .env
```

Edit `.env` and configure your email settings (optional):

```env
# Server Configuration
PORT=3001

# SMTP Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Email Notification Settings
EMAIL_FROM=Uptime Monitor <your-email@gmail.com>
EMAIL_TO=admin@example.com,ops@example.com
```

**Note**: Email notifications are optional. If you don't configure SMTP settings, the monitor will still work but won't send email alerts.

#### Gmail Setup (if using Gmail)

1. Enable 2-factor authentication on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password in the `SMTP_PASSWORD` field

## Usage

### Starting the Application

#### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

The backend will start on `http://localhost:3001` and the frontend on `http://localhost:3000`.

#### Production Mode

**Build and run backend:**
```bash
cd backend
npm run build
npm start
```

**Build and serve frontend:**
```bash
cd frontend
npm run build
npm run preview
```

### Adding Services to Monitor

1. Open the dashboard at `http://localhost:3000`
2. Click the "Add Service" button
3. Fill in the service details:
   - **Name**: A friendly name for your service (e.g., "Production API")
   - **URL**: The URL to monitor (e.g., "https://v7q64nlrc4w3am-5002.proxy.runpod.net/v1/activation/single")
   - **Check Interval**: How often to check (in seconds, minimum 30)
   - **Timeout**: Maximum time to wait for response (in seconds)
4. Click "Add Service"

The monitor will immediately start checking the service at the specified interval.

### Example Service Configuration

For the RunPod endpoint mentioned:

- **Name**: `Gemma-2-2B Activation`
- **URL**: `https://v7q64nlrc4w3am-5002.proxy.runpod.net/v1/activation/single`
- **Check Interval**: `60` (check every minute)
- **Timeout**: `30` (30 second timeout)

## API Endpoints

The backend provides a REST API:

### Services

- `GET /api/services` - Get all services
- `GET /api/services/:id` - Get service by ID
- `POST /api/services` - Create new service
- `PUT /api/services/:id` - Update service
- `DELETE /api/services/:id` - Delete service
- `POST /api/services/:id/check` - Manually trigger a health check

### Status

- `GET /api/status` - Get overall system status

### Incidents

- `GET /api/incidents` - Get all incidents
- `GET /api/services/:id/incidents` - Get incidents for a specific service

### Checks

- `GET /api/services/:id/checks` - Get check history for a service
- `GET /api/checks/recent` - Get recent checks across all services

## Database

The application uses SQLite for data storage. The database file is created at `backend/data/uptime.db`.

### Schema

- **services**: Stores service configurations and current status
- **service_checks**: Historical record of all health checks
- **incidents**: Tracks service outages and recoveries
- **notification_settings**: Notification configuration (future use)

## Monitoring Logic

### Health Check Status

- **Operational**: HTTP 200-299 response within timeout
- **Degraded**: Slow response (>80% of timeout) or 3xx/4xx status
- **Down**: 5xx errors, timeouts, or connection failures

### Incident Management

- An incident is created when a service transitions from any status to "down"
- The incident is resolved when the service recovers
- Email notifications are sent for both down and recovery events
- Downtime duration is automatically calculated

## Development

### Project Structure

```
UptimeMonitor/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   └── routes.ts          # API endpoints
│   │   ├── database/
│   │   │   └── schema.ts          # Database initialization
│   │   ├── models/
│   │   │   └── Service.ts         # Data models
│   │   ├── services/
│   │   │   ├── healthChecker.ts   # Health check logic
│   │   │   ├── monitoringService.ts # Monitoring orchestration
│   │   │   └── notificationService.ts # Email notifications
│   │   └── index.ts               # Server entry point
│   ├── data/                      # SQLite database location
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.tsx      # Main dashboard
│   │   │   ├── ServiceCard.tsx    # Service status card
│   │   │   └── AddServiceModal.tsx # Add service form
│   │   ├── api.ts                 # API client
│   │   ├── types.ts               # TypeScript types
│   │   ├── App.tsx                # Root component
│   │   └── main.tsx               # Entry point
│   └── package.json
└── README.md
```

### Adding New Notification Channels

The notification system is designed to be extensible. To add new channels (Slack, Discord, etc.):

1. Extend `NotificationService` in `backend/src/services/notificationService.ts`
2. Add configuration in `.env`
3. Implement send methods for new channels

## Troubleshooting

### Email notifications not working

- Check your SMTP credentials in `.env`
- Ensure your email provider allows SMTP access
- For Gmail, make sure you're using an App Password
- Check the backend logs for error messages

### Services showing as "Unknown"

- Wait for the first health check to complete
- Manually trigger a check using the refresh button
- Check that the service URL is accessible

### Database errors

- Ensure the `backend/data` directory exists
- Check file permissions
- Delete `uptime.db` to reset (you'll lose all data)

## License

MIT License - see LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
