import axios from 'axios';
import { Service, ServiceCheck, Incident, OverallStatus } from './types';

const api = axios.create({
  baseURL: '/api',
});

export const servicesApi = {
  getAll: () => api.get<Service[]>('/services'),
  getById: (id: number) => api.get<Service>(`/services/${id}`),
  create: (service: Partial<Service>) => api.post<Service>('/services', service),
  update: (id: number, service: Partial<Service>) =>
    api.put<Service>(`/services/${id}`, service),
  delete: (id: number) => api.delete(`/services/${id}`),
  checkNow: (id: number) => api.post<Service>(`/services/${id}/check`),
  getChecks: (id: number, limit?: number) =>
    api.get<ServiceCheck[]>(`/services/${id}/checks`, { params: { limit } }),
  getIncidents: (id: number, limit?: number) =>
    api.get<Incident[]>(`/services/${id}/incidents`, { params: { limit } }),
};

export const statusApi = {
  getOverall: () => api.get<OverallStatus>('/status'),
};

export const incidentsApi = {
  getAll: (limit?: number) =>
    api.get<Incident[]>('/incidents', { params: { limit } }),
};
