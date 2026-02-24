import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'uptime.db');
const db: DatabaseType = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
export function initializeDatabase() {
  // Services table
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      http_method TEXT DEFAULT 'GET',
      request_body TEXT,
      request_headers TEXT,
      check_interval INTEGER DEFAULT 900,
      timeout INTEGER DEFAULT 30,
      status TEXT DEFAULT 'unknown',
      last_check_at DATETIME,
      last_status_change_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Service checks table (history)
  db.exec(`
    CREATE TABLE IF NOT EXISTS service_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      response_time INTEGER,
      status_code INTEGER,
      error_message TEXT,
      checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
    )
  `);

  // Incidents table
  db.exec(`
    CREATE TABLE IF NOT EXISTS incidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER NOT NULL,
      started_at DATETIME NOT NULL,
      resolved_at DATETIME,
      duration INTEGER,
      error_message TEXT,
      notification_sent BOOLEAN DEFAULT 0,
      FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
    )
  `);

  // Notification settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      config TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: add http_method column to existing databases
  const columns = db.prepare("PRAGMA table_info(services)").all() as { name: string }[];
  if (!columns.some(col => col.name === 'http_method')) {
    db.exec("ALTER TABLE services ADD COLUMN http_method TEXT DEFAULT 'GET'");
  }

  // Migration: add request_body and request_headers columns
  if (!columns.some(col => col.name === 'request_body')) {
    db.exec("ALTER TABLE services ADD COLUMN request_body TEXT");
  }
  if (!columns.some(col => col.name === 'request_headers')) {
    db.exec("ALTER TABLE services ADD COLUMN request_headers TEXT");
  }

  // Migration: add follow_redirects and keep_cookies columns
  if (!columns.some(col => col.name === 'follow_redirects')) {
    db.exec("ALTER TABLE services ADD COLUMN follow_redirects INTEGER DEFAULT 1");
  }
  if (!columns.some(col => col.name === 'keep_cookies')) {
    db.exec("ALTER TABLE services ADD COLUMN keep_cookies INTEGER DEFAULT 1");
  }

  // Migration: add alert_type, alert_keyword, alert_http_statuses columns
  if (!columns.some(col => col.name === 'alert_type')) {
    db.exec("ALTER TABLE services ADD COLUMN alert_type TEXT DEFAULT 'unavailable'");
  }
  if (!columns.some(col => col.name === 'alert_keyword')) {
    db.exec("ALTER TABLE services ADD COLUMN alert_keyword TEXT");
  }
  if (!columns.some(col => col.name === 'alert_http_statuses')) {
    db.exec("ALTER TABLE services ADD COLUMN alert_http_statuses TEXT");
  }

  // Migration: add SSL verification columns
  if (!columns.some(col => col.name === 'verify_ssl')) {
    db.exec("ALTER TABLE services ADD COLUMN verify_ssl INTEGER DEFAULT 0");
  }
  if (!columns.some(col => col.name === 'ssl_expiry_threshold')) {
    db.exec("ALTER TABLE services ADD COLUMN ssl_expiry_threshold INTEGER DEFAULT 30");
  }

  // Migration: add domain verification column
  if (!columns.some(col => col.name === 'verify_domain')) {
    db.exec("ALTER TABLE services ADD COLUMN verify_domain INTEGER DEFAULT 0");
  }

  // Migration: add SSL/domain result columns to service_checks
  const checkColumns = db.prepare("PRAGMA table_info(service_checks)").all() as { name: string }[];
  if (!checkColumns.some(col => col.name === 'ssl_valid')) {
    db.exec("ALTER TABLE service_checks ADD COLUMN ssl_valid INTEGER");
  }
  if (!checkColumns.some(col => col.name === 'ssl_expires_at')) {
    db.exec("ALTER TABLE service_checks ADD COLUMN ssl_expires_at TEXT");
  }
  if (!checkColumns.some(col => col.name === 'ssl_issuer')) {
    db.exec("ALTER TABLE service_checks ADD COLUMN ssl_issuer TEXT");
  }
  if (!checkColumns.some(col => col.name === 'ssl_days_remaining')) {
    db.exec("ALTER TABLE service_checks ADD COLUMN ssl_days_remaining INTEGER");
  }
  if (!checkColumns.some(col => col.name === 'domain_valid')) {
    db.exec("ALTER TABLE service_checks ADD COLUMN domain_valid INTEGER");
  }
  if (!checkColumns.some(col => col.name === 'domain_error')) {
    db.exec("ALTER TABLE service_checks ADD COLUMN domain_error TEXT");
  }

  // On-call contacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS on_call_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // On-call schedules table
  db.exec(`
    CREATE TABLE IF NOT EXISTS on_call_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      recurrence TEXT DEFAULT 'none',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (contact_id) REFERENCES on_call_contacts(id) ON DELETE CASCADE
    )
  `);

  // Create app_settings table for admin password, email config, etc.
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Admin sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )
  `);

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_service_checks_service_id
    ON service_checks(service_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_service_checks_checked_at
    ON service_checks(checked_at);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_incidents_service_id
    ON incidents(service_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_on_call_schedules_contact_id
    ON on_call_schedules(contact_id);
  `);

  console.log('Database initialized successfully');
}

export default db;
