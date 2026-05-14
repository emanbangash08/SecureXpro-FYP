const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

function formatDetail(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map(err => {
        if (err && typeof err === 'object') {
          const e = err as { loc?: unknown[]; msg?: string; type?: string }
          const field = Array.isArray(e.loc) ? e.loc.filter(p => p !== 'body').join('.') : ''
          const msg = e.msg ?? e.type ?? 'invalid value'
          return field ? `${field}: ${msg}` : msg
        }
        return String(err)
      })
      .join('; ')
  }
  if (detail && typeof detail === 'object') {
    const d = detail as { msg?: string; message?: string }
    if (d.msg) return d.msg
    if (d.message) return d.message
    try { return JSON.stringify(detail) } catch { /* fall through */ }
  }
  return `HTTP ${status}`
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  Object.assign(headers, options.headers ?? {})

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(formatDetail(body.detail, res.status))
  }

  const text = await res.text()
  return text ? JSON.parse(text) : ({} as T)
}

export interface RegisterPayload {
  full_name: string
  username: string
  email: string
  password: string
  role: 'admin' | 'user' | 'agent'
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: {
    id: string
    username: string
    email: string
    full_name: string
    role: 'admin' | 'user' | 'agent'
    status: string
    created_at: string
    last_login: string | null
  }
}

export interface AdminStats {
  users: {
    total: number
    by_role: { admin: number; user: number; agent: number }
    active: number
    banned: number
  }
  scans: {
    total: number
    pending: number
    running: number
    completed: number
    failed: number
    cancelled: number
  }
  vulnerabilities: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
  }
}

export interface AdminUser {
  id: string
  username: string
  email: string
  full_name: string
  role: 'admin' | 'user' | 'agent'
  status: 'active' | 'inactive' | 'banned'
  created_at: string
  last_login: string | null
  scan_count?: number
}

export interface AdminUserDetail extends AdminUser {
  scan_count: number
  completed_scans: number
  failed_scans: number
  running_scans: number
  updated_at: string | null
}

export interface AdminScan {
  id: string
  user_id: string
  username: string
  user_email: string
  target: string
  scan_type: string
  status: string
  options: Record<string, unknown>
  current_phase: string | null
  risk_summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
    info: number
    max_cvss_score: number
    overall_risk: string
  } | null
  exploit_count: number
  vuln_count: number
  error: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  vulnerabilities?: Array<{
    id: string
    cve_id: string
    title: string
    severity: string
    cvss_score: number
    affected_host: string
    affected_service: string
    affected_port: number | null
    exploit_available: boolean
    remediation: string
    owasp: string | null
  }>
}

export interface AdminScanListOut {
  total: number
  items: AdminScan[]
}

export interface ScanDefaults {
  intensity: string
  thread_count: number
  timeout: number
}

export interface PlatformSettings {
  organization_name: string
  admin_email: string
  timezone: string
  email_notifications: boolean
  notify_critical: boolean
  notify_scan_complete: boolean
  notify_agent_status: boolean
  scan_defaults: ScanDefaults
  updated_at: string | null
}

export interface ApiReport {
  id: string
  scan_id: string
  user_id: string
  title: string
  format: 'pdf' | 'html' | 'json'
  file_path: string
  generated: boolean
  created_at: string
}

export interface ReportContent {
  report_id: string
  title: string
  format: string
  generated_at: string
  scan: {
    id: string
    target: string
    scan_type: string
    status: string
    started_at: string | null
    completed_at: string | null
  }
  risk_summary: {
    overall: string
    critical: number
    high: number
    medium: number
    low: number
    info: number
    max_cvss: number
  }
  vulnerability_count: number
  vulnerabilities: Array<{
    id: string
    cve_id: string
    title: string
    description: string
    severity: string
    cvss_score: number
    affected_host: string
    affected_service: string
    affected_port: number | null
    exploit_available: boolean
    remediation: string
    owasp: string | null
    evidence: string | null
    affected_url: string | null
  }>
}

export interface DashboardStats {
  scans: { total: number; running: number; completed: number; failed: number }
  vulnerabilities: Record<string, number>
  recent_scans: Array<{
    id: string
    target: string
    scan_type: string
    status: string
    risk_summary: Record<string, unknown>
    created_at: string
    started_at: string | null
    completed_at: string | null
  }>
  activity_feed: Array<{
    id: string
    type: string
    title: string
    severity: string
    timestamp: string | null
  }>
  vulnerability_trends: Array<{
    month: string
    critical: number
    high: number
    medium: number
    low: number
  }>
}

import type { ApiScan, ApiScanListOut, ScanCreatePayload, ApiScanType, ApiScanStatus } from './types'

export const api = {
  scans: {
    create: (payload: ScanCreatePayload) =>
      request<ApiScan>('/api/v1/scans/', { method: 'POST', body: JSON.stringify(payload) }),

    list: (params?: { skip?: number; limit?: number; scan_type?: ApiScanType; scan_status?: ApiScanStatus }) => {
      const qs = new URLSearchParams()
      if (params?.skip != null) qs.set('skip', String(params.skip))
      if (params?.limit != null) qs.set('limit', String(params.limit))
      if (params?.scan_type) qs.set('scan_type', params.scan_type)
      if (params?.scan_status) qs.set('scan_status', params.scan_status)
      return request<ApiScanListOut>(`/api/v1/scans/?${qs.toString()}`)
    },

    get: (scanId: string) => request<ApiScan>(`/api/v1/scans/${scanId}`),

    cancel: (scanId: string) =>
      request<ApiScan>(`/api/v1/scans/${scanId}/cancel`, { method: 'POST' }),

    retry: (scanId: string) =>
      request<ApiScan>(`/api/v1/scans/${scanId}/retry`, { method: 'POST' }),

    delete: (scanId: string) =>
      request<void>(`/api/v1/scans/${scanId}`, { method: 'DELETE' }),

    getLogs: (scanId: string, skip = 0) =>
      request<{ scan_id: string; count: number; logs: import('./types').ScanLog[] }>(
        `/api/v1/scans/${scanId}/logs?skip=${skip}`
      ),

    getReport: (scanId: string) =>
      request<import('./types').ScanReport>(`/api/v1/scans/${scanId}/report`),
  },

  vulnerabilities: {
    getAll: (params?: { severity?: string; skip?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.severity) qs.set('severity', params.severity)
      if (params?.skip != null) qs.set('skip', String(params.skip))
      if (params?.limit != null) qs.set('limit', String(params.limit))
      return request<{
        total: number; critical: number; high: number; medium: number; low: number
        items: Array<{
          id: string; scan_id: string; cve_id: string; title: string; description: string
          severity: string; cvss_score: number; affected_host: string; affected_service: string
          affected_port: number | null; exploit_available: boolean; remediation: string
          references: string[]; owasp: string | null; evidence: string | null
          affected_url: string | null; created_at: string
        }>
      }>(`/api/v1/vulnerabilities/?${qs.toString()}`)
    },

    getByScan: (scanId: string, params?: { severity?: string; skip?: number; limit?: number }) => {
      const qs = new URLSearchParams()
      if (params?.severity) qs.set('severity', params.severity)
      if (params?.skip != null) qs.set('skip', String(params.skip))
      if (params?.limit != null) qs.set('limit', String(params.limit))
      return request<{
        total: number; critical: number; high: number; medium: number; low: number
        items: Array<{
          id: string; scan_id: string; cve_id: string; title: string; description: string
          severity: string; cvss_score: number; affected_host: string; affected_service: string
          affected_port: number | null; exploit_available: boolean; remediation: string
          references: string[]; owasp: string | null; evidence: string | null
          affected_url: string | null; created_at: string
        }>
      }>(`/api/v1/vulnerabilities/scan/${scanId}?${qs.toString()}`)
    },
  },

  dashboard: {
    stats: () => request<DashboardStats>('/api/v1/dashboard/stats'),
  },

  reports: {
    list: () => request<ApiReport[]>('/api/v1/reports/'),
    get: (id: string) => request<ApiReport>(`/api/v1/reports/${id}`),
    create: (scan_id: string, title: string, format: 'pdf' | 'html' | 'json' = 'json') =>
      request<ApiReport>('/api/v1/reports/', {
        method: 'POST',
        body: JSON.stringify({ scan_id, title, format }),
      }),
    getContent: (id: string) => request<ReportContent>(`/api/v1/reports/${id}/content`),
    delete: (id: string) => request<void>(`/api/v1/reports/${id}`, { method: 'DELETE' }),
  },

  admin: {
    listUsers: () => request<AdminUser[]>('/api/v1/admin/users'),
    getUserDetail: (userId: string) =>
      request<AdminUserDetail>(`/api/v1/admin/users/${userId}/detail`),
    updateUser: (userId: string, data: { role?: string; status?: string }) =>
      request<AdminUser>(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteUser: (userId: string) =>
      request<void>(`/api/v1/admin/users/${userId}`, { method: 'DELETE' }),
    stats: () => request<AdminStats>('/api/v1/admin/stats'),
    listScans: (params?: {
      skip?: number; limit?: number
      status?: string; scan_type?: string; user_id?: string
      search?: string; date_from?: string; date_to?: string
      risk?: string; has_exploits?: boolean
    }) => {
      const qs = new URLSearchParams()
      if (params?.skip        != null)     qs.set('skip',         String(params.skip))
      if (params?.limit       != null)     qs.set('limit',        String(params.limit))
      if (params?.status)                  qs.set('status',       params.status)
      if (params?.scan_type)               qs.set('scan_type',    params.scan_type)
      if (params?.user_id)                 qs.set('user_id',      params.user_id)
      if (params?.search)                  qs.set('search',       params.search)
      if (params?.date_from)               qs.set('date_from',    params.date_from)
      if (params?.date_to)                 qs.set('date_to',      params.date_to)
      if (params?.risk)                    qs.set('risk',         params.risk)
      if (params?.has_exploits != null)    qs.set('has_exploits', String(params.has_exploits))
      return request<AdminScanListOut>(`/api/v1/admin/scans?${qs.toString()}`)
    },
    getScan: (scanId: string) =>
      request<AdminScan>(`/api/v1/admin/scans/${scanId}`),
  },

  settings: {
    get: () => request<PlatformSettings>('/api/v1/settings/'),
    update: (data: Partial<PlatformSettings>) =>
      request<PlatformSettings>('/api/v1/settings/', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  auth: {
    register: (data: RegisterPayload) =>
      request<{ id: string }>('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    login: (email: string, password: string) =>
      request<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: () => request<LoginResponse['user']>('/api/v1/auth/me'),

    refresh: (refresh_token: string) =>
      request<LoginResponse>('/api/v1/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refresh_token }),
      }),

    forgotPassword: (email: string) =>
      request<{ message: string; reset_token?: string }>('/api/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token: string, new_password: string) =>
      request<{ message: string }>('/api/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password }),
      }),
  },
}
