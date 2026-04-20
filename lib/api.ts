const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  Object.assign(headers, options.headers ?? {})

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: 'Request failed' }))
    throw new Error(body.detail ?? `HTTP ${res.status}`)
  }

  const text = await res.text()
  return text ? JSON.parse(text) : ({} as T)
}

export interface RegisterPayload {
  full_name: string
  username: string
  email: string
  password: string
  role: 'admin' | 'agent'
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
    role: 'admin' | 'agent'
    status: string
    created_at: string
    last_login: string | null
  }
}

export const api = {
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
