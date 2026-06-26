import type { NextFunction, Request, RequestHandler, Response } from 'express'

// Express 4는 async 핸들러의 reject를 잡지 못하므로 모든 비동기 핸들러를 이 래퍼로 감싼다
export function h(fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// KTO(한국관광공사) 이미지가 일부 http:// 로 저장돼 있어 안드로이드 릴리스 빌드(cleartext 차단)에서 안 뜸.
// visitkorea.or.kr 은 https 를 지원하므로 응답 단계에서 http→https 로 승격한다. (문자열만 수정 → BigInt/Date 등은 그대로 통과)
function upgradeKtoImageUrls(v: unknown, seen = new Set<object>()): void {
  if (!v || typeof v !== 'object' || seen.has(v as object)) return
  seen.add(v as object)
  const up = (s: string) => (s.startsWith('http://') && s.includes('visitkorea.or.kr') ? 'https://' + s.slice(7) : s)
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) {
      const x = v[i]
      if (typeof x === 'string') v[i] = up(x)
      else upgradeKtoImageUrls(x, seen)
    }
    return
  }
  for (const k of Object.keys(v as Record<string, unknown>)) {
    const x = (v as Record<string, unknown>)[k]
    if (typeof x === 'string') (v as Record<string, unknown>)[k] = up(x)
    else upgradeKtoImageUrls(x, seen)
  }
}

// 표준 응답 규약 (기획설계서 3장): { success: true, data } / { success: false, error }
export function ok(res: Response, data: unknown, status = 200): void {
  upgradeKtoImageUrls(data)
  res.status(status).json({ success: true, data })
}

export function created(res: Response, data: unknown): void {
  ok(res, data, 201)
}

export function noContent(res: Response): void {
  res.status(204).end()
}
