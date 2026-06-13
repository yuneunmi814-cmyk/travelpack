import { randomUUID } from 'node:crypto'
import { env, isProd } from '../../config/env.js'

// 결제 PG 어댑터 — S3/FCM과 동일한 게이팅. 두 가지 모드:
//   - 'mock'  : 개발/체험용 즉시 승인(운영에서는 비활성). PG_PROVIDER=mock 만으로 동작.
//   - 'portone': 실연동. 클라이언트가 PortOne SDK로 결제 후 받은 paymentId를 서버가 검증(금액 대조).
// 테스트는 setPaymentTransportForTest로 transport를 주입해 네트워크 없이 검증.

function provider(): string {
  return (process.env.PG_PROVIDER ?? env.PG_PROVIDER ?? '').trim()
}
function secret(): string {
  return (process.env.PG_API_SECRET ?? env.PG_API_SECRET ?? '').trim()
}

export function paymentMode(): 'mock' | 'portone' | 'off' {
  const p = provider()
  if (p === 'mock' && !isProd) return 'mock'
  if (p === 'portone' && secret()) return 'portone'
  return 'off'
}

export function isPaymentEnabled(): boolean {
  return paymentMode() !== 'off'
}

export interface ChargeRequest {
  amount: number // 원
  courseId: string
  userId: string
  description: string
  paymentId?: string // portone: 클라이언트 결제 후 받은 거래 식별자(서버가 검증)
}
export interface ChargeResult {
  ok: boolean
  paymentId: string
  provider: string
  failureReason?: string
}

export type PaymentTransport = (req: ChargeRequest) => Promise<ChargeResult>

// 기본 transport: paymentMode에 따라 분기.
let transport: PaymentTransport = async (req) => {
  const mode = paymentMode()
  if (mode === 'mock') return { ok: true, paymentId: `mock_${randomUUID()}`, provider: 'mock' }
  if (mode === 'portone') return verifyPortOnePayment(req)
  return { ok: false, paymentId: '', provider: provider() || 'unknown', failureReason: 'PG_NOT_CONFIGURED' }
}

export function setPaymentTransportForTest(fn: PaymentTransport): void {
  transport = fn
}

/** dev/test용 가짜 즉시 승인 transport — 항상 성공. */
export function mockApproveTransport(): PaymentTransport {
  return async () => ({ ok: true, paymentId: `mock_${randomUUID()}`, provider: 'mock' })
}

export async function charge(req: ChargeRequest): Promise<ChargeResult> {
  return transport(req)
}

// ── PortOne v2 실연동 ──────────────────────────────────────────────
// 카드 결제는 클라이언트(PortOne SDK)가 사용자 인증을 마친 뒤 paymentId를 돌려준다.
// 서버는 그 paymentId를 PortOne API로 단건 조회해 status=PAID·금액 일치를 검증한다(위변조 방지).
const PORTONE_API = 'https://api.portone.io'

async function verifyPortOnePayment(req: ChargeRequest): Promise<ChargeResult> {
  if (!req.paymentId) return { ok: false, paymentId: '', provider: 'portone', failureReason: 'PAYMENT_ID_REQUIRED' }
  try {
    const res = await fetch(`${PORTONE_API}/payments/${encodeURIComponent(req.paymentId)}`, {
      headers: { Authorization: `PortOne ${secret()}` },
    })
    if (!res.ok) return { ok: false, paymentId: req.paymentId, provider: 'portone', failureReason: `LOOKUP_${res.status}` }
    const data = (await res.json()) as { status?: string; amount?: { total?: number }; currency?: string }
    if (data.status !== 'PAID') return { ok: false, paymentId: req.paymentId, provider: 'portone', failureReason: `STATUS_${data.status ?? 'UNKNOWN'}` }
    // 서버 금액과 실제 결제 금액 대조(클라이언트 금액 신뢰 금지)
    if (Number(data.amount?.total) !== req.amount) {
      return { ok: false, paymentId: req.paymentId, provider: 'portone', failureReason: 'AMOUNT_MISMATCH' }
    }
    return { ok: true, paymentId: req.paymentId, provider: 'portone' }
  } catch {
    return { ok: false, paymentId: req.paymentId, provider: 'portone', failureReason: 'PG_NETWORK_ERROR' }
  }
}

/** PortOne 환불(전액). 운영 정산/청약철회 처리에서 사용. */
export async function refundPortOnePayment(paymentId: string, reason: string): Promise<boolean> {
  if (paymentMode() !== 'portone') return false
  try {
    const res = await fetch(`${PORTONE_API}/payments/${encodeURIComponent(paymentId)}/cancel`, {
      method: 'POST',
      headers: { Authorization: `PortOne ${secret()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** 플랫폼 수수료/정산 분배 계산(원 단위, 내림). */
export function settlement(price: number): { platformFee: number; creatorPayout: number; feePercent: number } {
  const feePercent = process.env.MARKETPLACE_FEE_PERCENT ? Number(process.env.MARKETPLACE_FEE_PERCENT) : env.MARKETPLACE_FEE_PERCENT
  const platformFee = Math.floor((price * feePercent) / 100)
  return { platformFee, creatorPayout: price - platformFee, feePercent }
}
