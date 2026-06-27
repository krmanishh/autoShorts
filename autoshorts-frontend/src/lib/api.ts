// src/lib/api.ts
import axios, { AxiosError } from 'axios'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Inject JWT on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('as_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global 401 handler — redirect to login
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('as_token')
      localStorage.removeItem('as_user')
      window.location.href = '/auth/login'
    }
    return Promise.reject(err)
  }
)

// ── Typed API helpers ──────────────────────────────────────

import type {
  AuthResponse,
  Automation,
  CreateAutomationPayload,
  DashboardStats,
  WeeklyPoint,
  GeneratedClip,
  PublicationFull,
  SystemLog,
  OAuthConnection,
  QueueStatus,
  HealthStatus,
} from '@/types'

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }).then((r) => r.data),
  register: (email: string, name: string, password: string) =>
    api.post<AuthResponse>('/api/auth/register', { email, name, password }).then((r) => r.data),
  connections: () =>
    api.get<OAuthConnection[]>('/api/auth/connections').then((r) => r.data),
  youtubeAuthUrl: () =>
    api.get<{ url: string }>('/api/auth/youtube').then((r) => r.data.url),
  instagramAuthUrl: () =>
    api.get<{ url: string }>('/api/auth/instagram').then((r) => r.data.url),
  facebookAuthUrl: () =>
    api.get<{ url: string }>('/api/auth/facebook').then((r) => r.data.url),
}

// Automations
export const automationsApi = {
  list: () =>
    api.get<Automation[]>('/api/automations').then((r) => r.data),
  create: (payload: CreateAutomationPayload) =>
    api.post<Automation>('/api/automations', payload).then((r) => r.data),
  setStatus: (id: string, status: 'RUNNING' | 'PAUSED') =>
    api.patch<{ success: boolean; status: string }>(`/api/automations/${id}/status`, { status }).then((r) => r.data),
  delete: (id: string) =>
    api.delete(`/api/automations/${id}`).then((r) => r.data),
}

// Dashboard
export const dashboardApi = {
  stats: () =>
    api.get<DashboardStats>('/api/dashboard/stats').then((r) => r.data),
  activity: (limit = 20) =>
    api.get<SystemLog[]>(`/api/dashboard/activity?limit=${limit}`).then((r) => r.data),
  weekly: () =>
    api.get<WeeklyPoint[]>('/api/dashboard/weekly').then((r) => r.data),
  clips: (page = 1, limit = 20) =>
    api.get<GeneratedClip[]>(`/api/dashboard/clips?page=${page}&limit=${limit}`).then((r) => r.data),
  publications: (page = 1, limit = 20) =>
    api.get<PublicationFull[]>(`/api/dashboard/publications?page=${page}&limit=${limit}`).then((r) => r.data),
  queueStatus: () =>
    api.get<QueueStatus>('/api/queues/status').then((r) => r.data),
  health: () =>
    api.get<HealthStatus>('/api/dashboard/health').then((r) => r.data),
}
