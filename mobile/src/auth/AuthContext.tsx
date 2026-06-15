import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, clearTokens, hasSession, loadTokens, setAuthLostHandler, setTokens, warmup } from '../api/client'
import { getKakaoAccessToken } from './social'
import type { Me } from '../api/types'

interface AuthState {
  ready: boolean
  user: Me | null
  isAuthed: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, nickname: string, consents?: Consent[]) => Promise<void>
  socialLogin: (provider: 'kakao' | 'google') => Promise<void>
  socialLoginWithToken: (provider: 'kakao' | 'google', providerAccessToken: string) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export interface Consent { type: string; agreed: boolean; version: string }

const BASE_CONSENTS: Consent[] = [
  { type: 'TERMS', agreed: true, version: '1.0' },
  { type: 'PRIVACY', agreed: true, version: '1.0' },
  { type: 'AGE14', agreed: true, version: '1.0' },
]

// 소셜 로그인 공통 — providerAccessToken을 백엔드로 전달(신규 가입 대비 필수 약관 동봉)
async function postSocial(provider: 'kakao' | 'google', providerAccessToken: string, refreshMe: () => Promise<void>) {
  const d = await api<{ accessToken: string; refreshToken: string; isNewUser: boolean }>('/auth/social', {
    method: 'POST', body: { provider, providerAccessToken, consents: BASE_CONSENTS },
  })
  await setTokens(d.accessToken, d.refreshToken)
  await refreshMe()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<Me | null>(null)

  const refreshMe = useCallback(async () => {
    if (!hasSession()) { setUser(null); return }
    try { setUser(await api<Me>('/users/me', { auth: true })) }
    catch { setUser(null) }
  }, [])

  useEffect(() => {
    setAuthLostHandler(() => setUser(null))
    warmup() // Render 슬립 깨우기(파이어앤포겟) — 첫 화면/로그인 cold start 완화
    ;(async () => {
      await loadTokens()
      await refreshMe()
      setReady(true)
    })()
  }, [refreshMe])

  const value = useMemo<AuthState>(() => ({
    ready,
    user,
    isAuthed: Boolean(user),
    async login(email, password) {
      const d = await api<{ accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST', body: { email, password },
      })
      await setTokens(d.accessToken, d.refreshToken)
      await refreshMe()
    },
    async signup(email, password, nickname, consents) {
      const d = await api<{ accessToken: string; refreshToken: string }>('/auth/signup', {
        method: 'POST', body: { email, password, nickname, consents: consents ?? BASE_CONSENTS },
      })
      await setTokens(d.accessToken, d.refreshToken)
      await refreshMe()
    },
    async socialLogin(provider) {
      if (provider !== 'kakao') throw new Error('구글 로그인은 화면에서 처리됩니다')
      await postSocial('kakao', await getKakaoAccessToken(), refreshMe)
    },
    async socialLoginWithToken(provider, providerAccessToken) {
      await postSocial(provider, providerAccessToken, refreshMe)
    },
    async logout() {
      await clearTokens()
      setUser(null)
    },
    refreshMe,
  } as AuthState), [ready, user, refreshMe])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
