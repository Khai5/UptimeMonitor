import axios from 'axios';
import { Service, PublicService, ServiceCheck, Incident, OverallStatus, DowntimeLog, OnCallContact, OnCallSchedule, AdminUser } from './types';

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
  login: (username: string, password: string) => api.post<{ success: boolean; firstTime?: boolean; token: string }>('/auth/login', { username, password }),
  getStatus: () => api.get<{ passwordSet: boolean }>('/auth/status'),
  logout: (token: string) => api.post('/auth/logout', {}, authHeaders(token)),
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

  // Admin user management
  getAdmins: (password: string) =>
    api.get<AdminUser[]>('/admin/admins', authHeaders(password)),
  createAdmin: (password: string, username: string, newPassword: string) =>
    api.post<AdminUser>('/admin/admins', { username, password: newPassword }, authHeaders(password)),
  deleteAdmin: (password: string, id: number) =>
    api.delete(`/admin/admins/${id}`, authHeaders(password)),

  // On-call contacts
  getOnCallContacts: (password: string) =>
    api.get<OnCallContact[]>('/admin/oncall/contacts', authHeaders(password)),
  createOnCallContact: (password: string, contact: { name: string; email: string; phone?: string }) =>
    api.post<OnCallContact>('/admin/oncall/contacts', contact, authHeaders(password)),
  updateOnCallContact: (password: string, id: number, contact: { name: string; email: string; phone?: string }) =>
    api.put<OnCallContact>(`/admin/oncall/contacts/${id}`, contact, authHeaders(password)),
  deleteOnCallContact: (password: string, id: number) =>
    api.delete(`/admin/oncall/contacts/${id}`, authHeaders(password)),

  // On-call schedules
  getOnCallSchedules: (password: string) =>
    api.get<OnCallSchedule[]>('/admin/oncall/schedules', authHeaders(password)),
  createOnCallSchedule: (password: string, schedule: { contact_id: number; name: string; start_time: string; end_time: string; recurrence: string }) =>
    api.post<OnCallSchedule>('/admin/oncall/schedules', schedule, authHeaders(password)),
  updateOnCallSchedule: (password: string, id: number, schedule: Partial<{ contact_id: number; name: string; start_time: string; end_time: string; recurrence: string }>) =>
    api.put<OnCallSchedule>(`/admin/oncall/schedules/${id}`, schedule, authHeaders(password)),
  deleteOnCallSchedule: (password: string, id: number) =>
    api.delete(`/admin/oncall/schedules/${id}`, authHeaders(password)),
  getCurrentOnCall: (password: string) =>
    api.get<{ current: OnCallSchedule | null }>('/admin/oncall/current', authHeaders(password)),
};
