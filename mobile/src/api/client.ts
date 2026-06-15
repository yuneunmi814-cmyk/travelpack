import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_BASE } from '../config'

const ACCESS = 'tp_access'
const REFRESH = 'tp_refresh'

let accessToken: string | null = null
let refreshToken: string | null = null

export async function loadTokens(): Promise<void> {
  accessToken = await AsyncStorage.getItem(ACCESS)
  refreshToken = await AsyncStorage.getItem(REFRESH)
}
export async function setTokens(access: string, refresh: string): Promise<void> {
  accessToken = access
  refreshToken = refresh
  await AsyncStorage.multiSet([[ACCESS, access], [REFRESH, refresh]])
}
export async function clearTokens(): Promise<void> {
  accessToken = null
  refreshToken = null
  await AsyncStorage.multiRemove([ACCESS, REFRESH])
}
export function hasSession(): boolean {
  return Boolean(accessToken)
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message)
  }
}

let onAuthLost: (() => void) | null = null
export function setAuthLostHandler(fn: () => void): void { onAuthLost = fn }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// Render 무료 인스턴스는 슬립 후 첫 요청이 ~50초 cold start이거나 502를 낼 수 있다.
// 타임아웃(요청당 20초) + 백오프 재시도로 cold start를 흡수한다.
// GET·gateway 5xx는 안전하게 재시도하고, POST는 중복 생성 방지를 위해 게이트웨이 5xx만 재시도.
async function fetchWithRetry(url: string, init: RequestInit, method: string, tries = 4): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 20000)
    try {
      const res = await fetch(url, { ...init, signal: ctrl.signal })
      clearTimeout(timer)
      if ((res.status === 502 || res.status === 503 || res.status === 504) && i < tries - 1) {
        await sleep(2000 * (i + 1)); continue
      }
      return res
    } catch (e) {
      clearTimeout(timer)
      lastErr = e
      // 네트워크 오류/타임아웃: GET만 재시도(POST는 서버 도달 여부 불확실 → 중복 방지)
      if (method === 'GET' && i < tries - 1) { await sleep(2000 * (i + 1)); continue }
      throw e
    }
  }
  throw lastErr ?? new Error('network')
}

// 앱 시작 시 백엔드를 미리 깨운다(파이어앤포겟) — 첫 화면 cold start 완화.
export function warmup(): void {
  const root = API_BASE.replace(/\/api\/v\d+$/, '')
  fetch(`${root}/health`).catch(() => {})
}

async function refresh(): Promise<boolean> {
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return false
    await setTokens(json.data.accessToken, json.data.refreshToken)
    return true
  } catch {
    return false
  }
}

interface Opts { method?: string; body?: unknown; auth?: boolean; retry?: boolean }

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const { method = 'GET', body, auth = false, retry = true } = opts
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['content-type'] = 'application/json'
  if (accessToken) headers.authorization = `Bearer ${accessToken}`

  const res = await fetchWithRetry(`${API_BASE}${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  }, method)

  if (res.status === 401 && auth && retry && refreshToken) {
    if (await refresh()) return api<T>(path, { ...opts, retry: false })
    await clearTokens()
    onAuthLost?.()
    throw new ApiError(401, 'AUTH_REQUIRED', '로그인이 필요합니다')
  }
  if (res.status === 204) return undefined as T

  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) {
    const err = json?.error ?? { code: 'UNKNOWN', message: `요청 실패 (${res.status})` }
    throw new ApiError(res.status, err.code, err.message, err.details)
  }
  return json.data as T
}
