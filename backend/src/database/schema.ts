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
      check_interval INTEGER DEFAULT 60,
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

  console.log('Database initialized successfully');
}

export default db;
