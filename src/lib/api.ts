import { offlineGet, getCachedValue, enqueueOffline } from './offline'

export const TOKEN_KEY = 'dhruva_token'
export const USER_KEY = 'dhruva_user'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getCachedUser<T = any>(): T | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function setCachedUser(u: unknown) {
  if (u) localStorage.setItem(USER_KEY, JSON.stringify(u))
  else localStorage.removeItem(USER_KEY)
}

export class ApiError extends Error {
  status: number
  detail: string
  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

async function rawFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(path, { ...options, headers, credentials: 'same-origin' })
  if (res.status === 401) {
    setToken(null)
    setCachedUser(null)
  }
  return res
}

export async function api<T = any>(
  path: string,
  options: RequestInit & { useCache?: boolean } = {},
): Promise<T> {
  try {
    const res = await rawFetch(path, options)
    if (res.status === 204) return undefined as T
    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    if (!res.ok) {
      const detail = data?.detail || data?.message || data?.error || `Request failed (${res.status})`
      throw new ApiError(res.status, typeof detail === 'string' ? detail : JSON.stringify(detail))
    }
    if ((options.method === 'GET' || !options.method) && options.useCache !== false) {
      offlineGet(path, data)
    }
    return data as T
  } catch (err) {
    if (err instanceof ApiError) throw err
    const isNetwork = err instanceof TypeError
    if ((options.method === 'GET' || !options.method) && isNetwork) {
      const cached = await getCached(path)
      if (cached) return cached as T
    }
    if (isNetwork) throw new ApiError(0, 'Network offline — request queued locally.')
    throw err
  }
}

export async function getCached<T = any>(path: string): Promise<T | null> {
  return getCachedValue<T>(path)
}

/** Queue a write so it can be replayed once connectivity returns (offline-first). */
export async function apiQueued(
  path: string,
  options: RequestInit & { entity?: string; entity_id?: string; operation?: string } = {},
): Promise<any> {
  try {
    return await api(path, options)
  } catch (err) {
    if (err instanceof ApiError && (err.status === 0 || err.status >= 500)) {
      await enqueueOffline({
        entity: options.entity || '',
        entity_id: options.entity_id || '',
        operation: options.operation || (options.method || 'POST').toLowerCase(),
        payload: options.body ? JSON.parse(options.body as string) : {},
        url: path,
      })
      return { queued: true }
    }
    throw err
  }
}

/** Download a protected file (pdf/csv) as a blob via authenticated fetch. */
export async function downloadFile(url: string, filename: string) {
  const res = await rawFetch(url)
  if (!res.ok) throw new ApiError(res.status, 'Download failed')
  const blob = await res.blob()
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

export const fmtNum = (n?: number | null, digits = 0) =>
  n === null || n === undefined || Number.isNaN(n) ? '—' : Number(n).toLocaleString('en-IN', { maximumFractionDigits: digits })