import { initializeDatabase } from './database/schema';
import { ServiceModel } from './models/Service';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
initializeDatabase();

// Sample services to add
const sampleServices = [
  {
    name: 'Graph - Qwen3-4B - H&P Transcoders',
    url: 'https://example.com/api/health',
    http_method: 'GET' as const,
    follow_redirects: true,
    keep_cookies: true,
    check_interval: 60,
    timeout: 30,
    alert_type: 'unavailable' as const,
    status: 'unknown' as const,
  },
  {
    name: 'Gemma-2-2B-IT (Fleet A)',
    url: 'https://example.com/api/v1/health',
    http_method: 'GET' as const,
    follow_redirects: true,
    keep_cookies: true,
    check_interval: 60,
    timeout: 30,
    alert_type: 'unavailable' as const,
    status: 'unknown' as const,
  },
  {
    name: 'Gemma-2-2B | RES-65k MLP-65k',
    url: 'https://v7q64nlrc4w3am-5002.proxy.runpod.net/v1/activation/single',
    http_method: 'POST' as const,
    follow_redirects: true,
    keep_cookies: true,
    check_interval: 60,
    timeout: 30,
    alert_type: 'unavailable' as const,
    status: 'unknown' as const,
  },
  {
    name: 'GPT2-Small',
    url: 'https://example.com/gpt2/health',
    http_method: 'GET' as const,
    follow_redirects: true,
    keep_cookies: true,
    check_interval: 60,
    timeout: 30,
    alert_type: 'unavailable' as const,
    status: 'unknown' as const,
  },
];

// Add sample services
console.log('Adding sample services...');

for (const service of sampleServices) {
  try {
    const created = ServiceModel.create(service);
    console.log(`✓ Added: ${created.name}`);
  } catch (error) {
    console.error(`✗ Failed to add: ${service.name}`, error);
  }
}

console.log('\nSample services added successfully!');
console.log('You can now start the backend server with: npm run dev');
