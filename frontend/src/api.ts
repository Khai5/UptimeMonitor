import axios from 'axios';
import { Service, PublicService, ServiceCheck, Incident, OverallStatus, DowntimeLog } from './types';

const api = axios.create({
  baseURL: '/api',
});

// Helper to get auth headers
function authHeaders(password: string) {
  return { headers: { Authorization: `Bearer ${password}` } };
}

// ========== PUBLIC API (no auth required) ==========
export const publicApi = {
  getServices: () => api.get<PublicService[]>('/public/services'),
  getStatus: () => api.get<OverallStatus>('/public/status'),
};

// ========== AUTH API ==========
export const authApi = {
  login: (password: string) => api.post<{ success: boolean; firstTime?: boolean }>('/auth/login', { password }),
  getStatus: () => api.get<{ passwordSet: boolean }>('/auth/status'),
};

// ========== ADMIN API (requires password) ==========
export const adminApi = {
  getServices: (password: string) =>
    api.get<Service[]>('/admin/services', authHeaders(password)),
  getServiceById: (password: string, id: number) =>
    api.get<Service>(`/admin/services/${id}`, authHeaders(password)),
  createService: (password: string, service: Partial<Service>) =>
    api.post<Service>('/admin/services', service, authHeaders(password)),
  updateService: (password: string, id: number, updates: Partial<Service>) =>
    api.put<Service>(`/admin/services/${id}`, updates, authHeaders(password)),
  deleteService: (password: string, id: number) =>
    api.delete(`/admin/services/${id}`, authHeaders(password)),
  checkNow: (password: string, id: number) =>
    api.post<Service>(`/admin/services/${id}/check`, {}, authHeaders(password)),
  getChecks: (password: string, id: number, limit?: number) =>
    api.get<ServiceCheck[]>(`/admin/services/${id}/checks`, { ...authHeaders(password), params: { limit } }),
  getIncidents: (password: string, id: number, limit?: number) =>
    api.get<Incident[]>(`/admin/services/${id}/incidents`, { ...authHeaders(password), params: { limit } }),
  getAllIncidents: (password: string, limit?: number) =>
    api.get<Incident[]>('/admin/incidents', { ...authHeaders(password), params: { limit } }),
  getDowntimeLog: (password: string, id: number) =>
    api.get<DowntimeLog>(`/admin/services/${id}/downtime-log`, authHeaders(password)),
  getAllDowntimeLogs: (password: string) =>
    api.get<Record<number, DowntimeLog>>('/admin/downtime-logs', authHeaders(password)),
  getStatus: (password: string) =>
    api.get<OverallStatus>('/admin/status', authHeaders(password)),
  getSettings: (password: string) =>
    api.get<Record<string, string>>('/admin/settings', authHeaders(password)),
  updateSettings: (password: string, settings: Record<string, string>) =>
    api.put<Record<string, string>>('/admin/settings', settings, authHeaders(password)),
  changePassword: (password: string, newPassword: string) =>
    api.post('/admin/change-password', { new_password: newPassword }, authHeaders(password)),
  sendTestEmail: (password: string) =>
    api.post('/admin/test-email', {}, authHeaders(password)),
};
